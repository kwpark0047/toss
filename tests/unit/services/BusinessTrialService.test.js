const { BusinessTrialService } = require('../../../services/BusinessTrialService');

function makeDb({ updated = [], current = [], listed = [], locked = [], stores = [] } = {}) {
  const calls = [];
  const tx = {
    $queryRawUnsafe: jest.fn(async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.includes('UPDATE public.users')) return updated;
      if (sql.includes('SELECT id, business_access_status')) return current;
      if (sql.includes('SELECT id, email, trial_started_at')) return locked;
      if (sql.includes('SELECT id FROM public.stores')) return stores;
      return listed;
    }),
    $executeRawUnsafe: jest.fn(async (sql, ...args) => calls.push({ sql, args })),
  };
  return {
    calls,
    query: jest.fn(tx.$queryRawUnsafe),
    $queryRawUnsafe: tx.$queryRawUnsafe,
    $transaction: jest.fn((work) => work(tx)),
  };
}

describe('BusinessTrialService', () => {
  test('rejects unknown filters before querying the database', async () => {
    const db = makeDb();
    await expect(new BusinessTrialService(db).list('pending')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test('lists expired trials with a clamped limit and readable legacy phone data', async () => {
    const db = makeDb({ listed: [{ id: 7, phone: '01012345678', business_access_status: 'trialing' }] });
    const result = await new BusinessTrialService(db).list('expired', 1000);
    expect(result[0].phone).toBe('01012345678');
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("trial_ends_at <= now()"), 100);
  });

  test('extends a trial from its current end and audits it in the same transaction', async () => {
    const db = makeDb({ updated: [{ id: 7, phone: null, business_access_status: 'trialing' }] });
    const result = await new BusinessTrialService(db).extendTrial('7', 99, 14);
    expect(result.business_access_status).toBe('trialing');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.calls[0].args).toEqual([7, 14]);
    expect(db.calls[0].sql).toContain('GREATEST(COALESCE(trial_ends_at, now()), now())');
    expect(db.calls[0].sql).toContain('trial_started_at IS NOT NULL');
    expect(db.calls.some(({ args }) => args.includes('business-trial:extended:14d:admin:99'))).toBe(true);
  });

  test('defaults to a 30-day extension', async () => {
    const db = makeDb({ updated: [{ id: 7, phone: null }] });
    await new BusinessTrialService(db).extendTrial(7, 99);
    expect(db.calls[0].args).toEqual([7, 30]);
  });

  test.each([0, -1, 91, 1.5, 'abc'])('rejects invalid extension length %p before querying', async (days) => {
    const db = makeDb();
    await expect(new BusinessTrialService(db).extendTrial(7, 99, days)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.calls).toHaveLength(0);
  });

  test('returns not found when no trial account matches', async () => {
    const db = makeDb({ updated: [] });
    await expect(new BusinessTrialService(db).extendTrial(7, 99, 30)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.calls.some(({ sql }) => sql.includes('INSERT INTO public.auth_account_events'))).toBe(false);
  });

  test('anonymizes trial identity, revokes sessions and preserves finance references', async () => {
    const db = makeDb({ locked: [{ id: 7, email: 'trial@example.com', trial_started_at: new Date() }] });
    const result = await new BusinessTrialService(db).deleteAccount(7, 99);
    expect(result).toMatchObject({ deleted: true, anonymized: true, financialRecordsRetained: true });
    expect(db.calls.some(({ sql }) => sql.includes("auth_status='deletion_pending'") && sql.includes('email=NULL'))).toBe(true);
    expect(db.calls.some(({ sql }) => sql.includes('UPDATE public.auth_sessions SET revoked_at'))).toBe(true);
    expect(db.calls.some(({ args }) => args.includes('business-trial:account-deleted:admin:99'))).toBe(true);
  });

  test('refuses to remove a trial account that owns stores', async () => {
    const db = makeDb({ locked: [{ id: 7, email: 'trial@example.com', trial_started_at: new Date() }], stores: [{ id: 3 }] });
    await expect(new BusinessTrialService(db).deleteAccount(7, 99)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.calls.some(({ sql }) => sql.includes("auth_status='deletion_pending'"))).toBe(false);
  });

  test('does not permit super-admin accounts to be deleted through the trial action', async () => {
    const db = makeDb({ locked: [] });
    await expect(new BusinessTrialService(db).deleteAccount(7, 99)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.calls[0].sql).toContain("COALESCE(role,'user') <> 'super_admin'");
    expect(db.calls.some(({ sql }) => sql.includes("auth_status='deletion_pending'"))).toBe(false);
  });
});


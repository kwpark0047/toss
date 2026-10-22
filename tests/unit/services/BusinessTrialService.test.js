const { BusinessTrialService } = require('../../../services/BusinessTrialService');

function makeDb({ updated = [], current = [], listed = [], locked = [], stores = [] } = {}) {
  const calls = [];
  const tx = {
    $queryRawUnsafe: jest.fn(async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.includes('FOR UPDATE')) return locked;
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
    await expect(new BusinessTrialService(db).list('pending')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test('lists expired trials with a clamped limit and readable legacy phone data', async () => {
    const db = makeDb({
      listed: [{ id: 7, phone: '01012345678', business_access_status: 'trialing' }],
    });
    const result = await new BusinessTrialService(db).list('expired', 1000);
    expect(result[0].phone).toBe('01012345678');
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('trial_ends_at <= now()'),
      100
    );
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/EXISTS \(\s*SELECT 1 FROM public\.stores/),
      100
    );
  });

  test('all business access filters exclude ordinary non-business users with approved defaults', async () => {
    const db = makeDb({ listed: [] });
    await new BusinessTrialService(db).list('all');
    const sql = db.$queryRawUnsafe.mock.calls[0][0];
    expect(sql).toContain('trial_started_at IS NOT NULL');
    expect(sql).toContain('SELECT 1 FROM public.stores s WHERE s.user_id=public.users.id');
  });

  test('approves an eligible account and writes the audit event in the same transaction', async () => {
    const db = makeDb({ updated: [{ id: 7, phone: null, business_access_status: 'approved' }] });
    const result = await new BusinessTrialService(db).approve('7', 99);
    expect(result.business_access_status).toBe('approved');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.calls[0].args).toEqual([7, 99]);
    expect(db.calls.some(({ sql }) => sql.includes("'business-trial:approved'"))).toBe(true);
  });

  test('returns conflict when an account is already approved', async () => {
    const db = makeDb({ current: [{ id: 7, business_access_status: 'approved' }] });
    await expect(new BusinessTrialService(db).approve(7, 99)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('revokes formal approval transactionally and audits it', async () => {
    const db = makeDb({ updated: [{ id: 7, business_access_status: 'trialing' }] });
    const result = await new BusinessTrialService(db).revokeApproval(7, 99);
    expect(result.business_access_status).toBe('trialing');
    expect(db.calls[0].sql).toContain("business_access_status='trialing'");
    expect(db.calls[0].sql).toContain('trial_ends_at=COALESCE(trial_ends_at,now())');
    expect(
      db.calls.some(({ args }) => args.includes('business-trial:approval-revoked:admin:99'))
    ).toBe(true);
  });

  test('anonymizes trial identity, revokes sessions and preserves finance references', async () => {
    const db = makeDb({
      locked: [{ id: 7, email: 'trial@example.com', trial_started_at: new Date() }],
    });
    const result = await new BusinessTrialService(db).deleteAccount(7, 99);
    expect(result).toMatchObject({
      deleted: true,
      anonymized: true,
      financialRecordsRetained: true,
    });
    expect(
      db.calls.some(
        ({ sql }) => sql.includes("auth_status='deletion_pending'") && sql.includes('email=NULL')
      )
    ).toBe(true);
    expect(
      db.calls.some(({ sql }) => sql.includes('UPDATE public.auth_sessions SET revoked_at'))
    ).toBe(true);
    expect(
      db.calls.some(({ args }) => args.includes('business-trial:account-deleted:admin:99'))
    ).toBe(true);
  });

  test('refuses to remove a trial account that owns stores', async () => {
    const db = makeDb({
      locked: [{ id: 7, email: 'trial@example.com', trial_started_at: new Date() }],
      stores: [{ id: 3 }],
    });
    await expect(new BusinessTrialService(db).deleteAccount(7, 99)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.calls.some(({ sql }) => sql.includes("auth_status='deletion_pending'"))).toBe(false);
  });

  test('does not permit super-admin accounts to be deleted through the trial action', async () => {
    const db = makeDb({ locked: [] });
    await expect(new BusinessTrialService(db).deleteAccount(7, 99)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.calls[0].sql).toContain("COALESCE(role,'user') <> 'super_admin'");
    expect(db.calls.some(({ sql }) => sql.includes("auth_status='deletion_pending'"))).toBe(false);
  });

  test('restricts a business account, records the reason, revokes sessions and audits in one transaction', async () => {
    const db = makeDb({
      locked: [{ id: 7, business_access_status: 'approved' }],
      updated: [
        { id: 7, business_access_status: 'suspended', business_access_note: '반복적인 정책 위반' },
      ],
    });
    const result = await new BusinessTrialService(db).restrictAccess(
      7,
      'suspended',
      '반복적인 정책 위반',
      99
    );
    expect(result.business_access_status).toBe('suspended');
    expect(
      db.calls.some(
        ({ sql, args }) =>
          sql.includes('business_access_previous_status=business_access_status') &&
          sql.includes('business_access_status=$2') &&
          args[1] === 'suspended' &&
          args[2] === '반복적인 정책 위반'
      )
    ).toBe(true);
    expect(
      db.calls.some(({ sql }) => sql.includes('UPDATE public.auth_sessions SET revoked_at'))
    ).toBe(true);
    expect(db.calls.some(({ args }) => args.includes('business-access:suspended:admin:99'))).toBe(
      true
    );
  });

  test('allows suspending and later restoring a legacy approved account without a trial timestamp', async () => {
    const db = makeDb({
      locked: [{ id: 7, business_access_status: 'approved' }],
      updated: [{ id: 7, business_access_status: 'suspended' }],
    });
    await new BusinessTrialService(db).restrictAccess(7, 'suspended', '운영 정책 위반 확인', 99);
    expect(db.calls[0].sql).toContain('SELECT id, business_access_status FROM public.users');
    expect(
      db.calls.some(({ sql }) =>
        sql.includes('business_access_previous_status=business_access_status')
      )
    ).toBe(true);

    const restoreDb = makeDb({
      locked: [
        { id: 7, business_access_status: 'suspended', business_access_previous_status: 'approved' },
      ],
      updated: [{ id: 7, business_access_status: 'approved' }],
    });
    await expect(new BusinessTrialService(restoreDb).restoreAccess(7, 99)).resolves.toMatchObject({
      business_access_status: 'approved',
    });
    expect(restoreDb.calls[1].args).toEqual([7, 'approved', 99]);
  });

  test('requires a bounded reason before changing access', async () => {
    const db = makeDb();
    await expect(
      new BusinessTrialService(db).restrictAccess(7, 'fraud_review', ' ', 99)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  test('restores a suspended approved account as approved', async () => {
    const db = makeDb({
      locked: [
        { id: 7, business_access_status: 'suspended', business_access_previous_status: 'approved' },
      ],
      updated: [{ id: 7, business_access_status: 'approved' }],
    });
    await expect(new BusinessTrialService(db).restoreAccess(7, 99)).resolves.toMatchObject({
      business_access_status: 'approved',
    });
    expect(db.calls.some(({ args }) => args.includes('approved'))).toBe(true);
    expect(
      db.calls.some(({ args }) => args.includes('business-access:restored:approved:admin:99'))
    ).toBe(true);
  });

  test('restores a suspended unapproved account as trialing without extending its deadline', async () => {
    const db = makeDb({
      locked: [{ id: 7, business_access_status: 'fraud_review', business_approved_at: null }],
      updated: [{ id: 7, business_access_status: 'trialing', trial_ends_at: new Date(0) }],
    });
    await expect(new BusinessTrialService(db).restoreAccess(7, 99)).resolves.toMatchObject({
      business_access_status: 'trialing',
    });
    expect(db.calls[1].args).toEqual([7, 'trialing', 99]);
    expect(db.calls[1].sql).toContain('trial_ends_at');
  });
});

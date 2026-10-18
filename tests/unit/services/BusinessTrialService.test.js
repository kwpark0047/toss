const { BusinessTrialService } = require('../../../services/BusinessTrialService');

function makeDb({ updated = [], current = [], listed = [] } = {}) {
  const calls = [];
  const tx = {
    $queryRawUnsafe: jest.fn(async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.includes('UPDATE public.users')) return updated;
      if (sql.includes('SELECT id, business_access_status')) return current;
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
    await expect(new BusinessTrialService(db).approve(7, 99)).rejects.toMatchObject({ statusCode: 409 });
  });
});


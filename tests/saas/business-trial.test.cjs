const test = require('node:test');
const assert = require('node:assert/strict');
const { BusinessTrialService } = require('../../services/BusinessTrialService');

function makeDb({ updated = [], current = [] } = {}) {
  const calls = [];
  const tx = {
    $queryRawUnsafe: async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.includes('UPDATE public.users')) return updated;
      if (sql.includes('SELECT id, business_access_status')) return current;
      return [];
    },
    $executeRawUnsafe: async (sql, ...args) => { calls.push({ sql, args }); },
  };
  return {
    calls,
    $queryRawUnsafe: tx.$queryRawUnsafe,
    $transaction: async (fn) => fn(tx),
  };
}

test('lists trial accounts with expiry-aware status and a bounded limit', async () => {
  const db = makeDb();
  const service = new BusinessTrialService(db);
  await service.list('trialing', 1000);
  const [{ sql, args }] = db.calls;
  assert.match(sql, /business_access_status='trialing' AND trial_ends_at > now\(\)/);
  assert.deepEqual(args, [100]);
  assert.match(sql, /CASE WHEN business_access_status='trialing' AND trial_ends_at <= now\(\)/);
});

test('rejects unsupported list filters', async () => {
  const service = new BusinessTrialService(makeDb());
  await assert.rejects(service.list('pending'), (error) => error.statusCode === 400);
});

test('approves an eligible account and writes the approval audit event atomically', async () => {
  const db = makeDb({ updated: [{ id: 7, business_access_status: 'approved', trial_ends_at: new Date() }] });
  const account = await new BusinessTrialService(db).approve('7', 99);
  assert.equal(account.id, 7);
  assert.equal(db.calls[0].args[0], 7);
  assert.equal(db.calls[0].args[1], 99);
  assert.match(db.calls[0].sql, /WHERE id=\$1 AND business_access_status='trialing'/);
  assert.ok(db.calls.some(({ sql }) => sql.includes("'business-trial:approved'")));
});

test('prevents duplicate approval through a conditional update', async () => {
  const db = makeDb({ current: [{ id: 7, business_access_status: 'approved' }] });
  await assert.rejects(new BusinessTrialService(db).approve(7, 99), (error) => error.statusCode === 409);
  assert.equal(db.calls.filter(({ sql }) => sql.includes('UPDATE public.users')).length, 1);
  assert.equal(db.calls.some(({ sql }) => sql.includes('INSERT INTO public.auth_account_events')), false);
});

test('returns not found when the account does not exist', async () => {
  const service = new BusinessTrialService(makeDb());
  await assert.rejects(service.approve(999, 99), (error) => error.statusCode === 404);
});


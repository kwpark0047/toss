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
  assert.match(sql, /CASE WHEN business_access_status='trialing' AND trial_ends_at > now\(\)\s+THEN 'trialing' ELSE 'expired'/);
});

test('rejects unsupported list filters', async () => {
  const service = new BusinessTrialService(makeDb());
  await assert.rejects(service.list('pending'), (error) => error.statusCode === 400);
});

test('extends a trial account and writes the extension audit event atomically', async () => {
  const db = makeDb({ updated: [{ id: 7, business_access_status: 'trialing', trial_ends_at: new Date() }] });
  const account = await new BusinessTrialService(db).extendTrial('7', 99, 30);
  assert.equal(account.id, 7);
  assert.deepEqual(db.calls[0].args, [7, 30]);
  assert.match(db.calls[0].sql, /business_access_status IN \('trialing','approved'\)/);
  assert.ok(db.calls.some(({ args }) => args.includes('business-trial:extended:30d:admin:99')));
});

test('returns not found and skips auditing when the account cannot be extended', async () => {
  const db = makeDb();
  await assert.rejects(new BusinessTrialService(db).extendTrial(999, 99), (error) => error.statusCode === 404);
  assert.equal(db.calls.some(({ sql }) => sql.includes('INSERT INTO public.auth_account_events')), false);
});


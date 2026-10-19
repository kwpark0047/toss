const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const url = new URL(process.env.P0_TEST_DATABASE_URL || 'http://missing');
if (url.hostname !== '127.0.0.1' || url.port !== '55438' || url.pathname !== '/wemarket_p0_schema_test') {
  throw new Error('ISOLATED_TEST_DB_REQUIRED');
}
process.env.DATABASE_URL = url.href;
process.env.DIRECT_URL = url.href;
process.env.REPLICA_URL = url.href;
process.env.JWT_SECRET = 'business-access-local-fixture';
process.env.JWT_REFRESH_SECRET = 'business-access-refresh-local-fixture';
process.env.NODE_ENV = 'test';

const db = require('../../config/prisma');
const sessions = require('../../services/AuthSessionService');
const { BusinessTrialService } = require('../../services/BusinessTrialService');
const { assertUserCanWrite } = require('../../middleware/businessTrialAccess');

test.after(async () => db.disconnectAll());

async function createBusiness(status = 'trialing', trialEnd = new Date(Date.now() + 60_000)) {
  return db.users.create({ data: {
    password: 'fixture-only',
    email: `${crypto.randomUUID()}@test.invalid`,
    role: 'user',
    business_access_status: status,
    trial_started_at: new Date(),
    trial_ends_at: trialEnd,
  } });
}

test('legacy accounts default to continuing approved access', async () => {
  const account = await db.users.create({ data: {
    password: 'fixture-only', email: `${crypto.randomUUID()}@test.invalid`, role: 'user',
  } });
  try {
    assert.equal(account.business_access_status, 'approved');
    await assertUserCanWrite(account.id);
  } finally {
    await db.users.delete({ where: { id: account.id } });
  }
});

test('suspension can stop and safely restore a legacy approved account without converting it to a trial', async () => {
  const account = await db.users.create({ data: {
    password: 'fixture-only', email: `${crypto.randomUUID()}@test.invalid`, role: 'user',
  } });
  try {
    const service = new BusinessTrialService(db);
    await service.restrictAccess(account.id, 'fraud_review', 'isolated regression test', 1);
    await assert.rejects(assertUserCanWrite(account.id), { code: 'BUSINESS_ACCOUNT_REVIEW' });
    const restored = await service.restoreAccess(account.id, 1);
    assert.equal(restored.business_access_status, 'approved');
    await assertUserCanWrite(account.id);
  } finally {
    await db.auth_account_events.deleteMany({ where: { user_id: account.id } });
    await db.authSession.deleteMany({ where: { user_id: account.id } });
    await db.users.delete({ where: { id: account.id } });
  }
});

test('expired trial writes stop exactly at the deadline while approval restores writes', async () => {
  const account = await createBusiness('trialing', new Date(Date.now() - 1_000));
  try {
    await assert.rejects(assertUserCanWrite(account.id), { code: 'TRIAL_EXPIRED' });
    await new BusinessTrialService(db).approve(account.id, 1);
    await assertUserCanWrite(account.id);
  } finally {
    await db.auth_account_events.deleteMany({ where: { user_id: account.id } });
    await db.users.delete({ where: { id: account.id } });
  }
});

test('simultaneous approval has one winner and writes one audit event', async () => {
  const account = await createBusiness('trialing', new Date(Date.now() - 1_000));
  try {
    const service = new BusinessTrialService(db);
    const outcomes = await Promise.allSettled([service.approve(account.id, 1), service.approve(account.id, 2)]);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected' && outcome.reason.statusCode === 409).length, 1);
    const events = await db.auth_account_events.count({ where: { user_id: account.id, event: 'business-trial:approved' } });
    assert.equal(events, 1);
    const final = await db.users.findUnique({ where: { id: account.id } });
    assert.equal(final.business_access_status, 'approved');
  } finally {
    await db.auth_account_events.deleteMany({ where: { user_id: account.id } });
    await db.users.delete({ where: { id: account.id } });
  }
});

test('suspension revokes existing sessions and restored trial keeps original expiry', async () => {
  const deadline = new Date(Date.now() - 1_000);
  const account = await createBusiness('trialing', deadline);
  try {
    const pair = await sessions.issue(account);
    const service = new BusinessTrialService(db);
    await service.restrictAccess(account.id, 'suspended', 'isolated regression test', 1);
    // Revocation is intentionally indistinguishable from other invalid sessions at the auth boundary.
    await assert.rejects(sessions.verifyAccess(require('jsonwebtoken').verify(pair.token, process.env.JWT_SECRET)), { statusCode: 401 });
    const restored = await service.restoreAccess(account.id, 1);
    assert.equal(restored.business_access_status, 'trialing');
    assert.equal(new Date(restored.trial_ends_at).getTime(), deadline.getTime());
  } finally {
    await db.auth_account_events.deleteMany({ where: { user_id: account.id } });
    await db.authSession.deleteMany({ where: { user_id: account.id } });
    await db.users.delete({ where: { id: account.id } });
  }
});


const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePlan,
  isTrialActive,
  ownerTrialEndsAt,
  TRIAL_PLAN,
} = require('../../utils/subscriptionPolicy');

const now = new Date('2026-11-03T00:00:00Z');
const later = new Date('2026-11-20T00:00:00Z');
const earlier = new Date('2026-10-01T00:00:00Z');

test('the signup trial unlocks the pro plan', () => {
  assert.equal(TRIAL_PLAN, 'pro');
  assert.equal(resolvePlan(null, later, now), 'pro');
});

test('the trial ends exactly at trial_ends_at and falls back to free', () => {
  assert.equal(resolvePlan(null, now, now), 'free');
  assert.equal(resolvePlan(null, earlier, now), 'free');
  assert.equal(resolvePlan(null, null, now), 'free');
  assert.equal(resolvePlan(null, 'not-a-date', now), 'free');
});

test('an active paid subscription takes precedence over the trial', () => {
  const enterprise = { status: 'active', current_period_end: later, plan: { name: 'enterprise' } };
  assert.equal(resolvePlan(enterprise, later, now), 'enterprise');
});

test('a lapsed paid subscription still gets the trial while it is active', () => {
  const lapsed = { status: 'past_due', current_period_end: earlier, plan: { name: 'enterprise' } };
  assert.equal(resolvePlan(lapsed, later, now), 'pro');
  assert.equal(resolvePlan(lapsed, earlier, now), 'free');
});

test('isTrialActive treats invalid input as inactive', () => {
  assert.equal(isTrialActive(undefined, now), false);
  assert.equal(isTrialActive(later, now), true);
});

test('ownerTrialEndsAt only grants trials to active trialing or approved owners and tolerates missing rows', async () => {
  let sqlText = '';
  const db = { $queryRaw: async (sql, ...args) => { sqlText = sql.join('?'); assert.deepEqual(args, [5]); return [{ trial_ends_at: later }]; } };
  assert.equal(await ownerTrialEndsAt(db, '5'), later);
  assert.match(sqlText, /u.auth_status = 'active'/);
  assert.match(sqlText, /business_access_status IN \('trialing', 'approved'\)/);
  assert.equal(await ownerTrialEndsAt({ $queryRaw: async () => [] }, 5), null);
  assert.equal(await ownerTrialEndsAt({ $queryRaw: async () => { throw new Error('must not query'); } }, 'x'), null);
});

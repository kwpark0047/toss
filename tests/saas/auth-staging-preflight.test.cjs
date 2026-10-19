const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('../../scripts/auth-staging-preflight.cjs');
const db = 'postgresql://fixture:fixture@127.0.0.1:55438/wemarket_test_staging_20261010';
test('auth staging preflight rejects production DB and production app origins', () => {
  assert.throws(() => inspect({ DATABASE_URL: 'postgresql://user:secret@db.example.com/prod' }, {}), /ISOLATED/);
  assert.throws(() => inspect({ DATABASE_URL: db }, { FRONTEND_URL: 'https://wemarket-saas.vercel.app' }), /STAGING_ORIGIN/);
});
test('missing credentials remain blocked and no input secret is returned', () => {
  const result = inspect({ DATABASE_URL: db }, { GOOGLE_CLIENT_SECRET: 'sensitive-value' });
  assert.equal(result.ready, false);
  assert.ok(result.missing.includes('GOOGLE_CLIENT_ID'));
  assert.ok(!JSON.stringify(result).includes('sensitive-value'));
});


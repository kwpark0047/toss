const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { DirectEmailSignupService } = require('../../services/DirectEmailSignupService');
const { SIGNUP_CONSENT_VERSION } = require('../../utils/freeAuthPolicy');

function fixture({ existing = false, bucketHits = [1, 1], sessionError = null } = {}) {
  const calls = { event: null, inserted: null, issued: 0, sql: [] };
  let buckets = 0;
  const tx = {
    $executeRawUnsafe: async (sql, ...args) => {
      calls.sql.push(sql);
      if (sql.includes('INSERT INTO auth_account_events')) calls.event = args;
    },
    $queryRawUnsafe: async (sql, ...args) => {
      calls.sql.push(sql);
      if (sql.includes('RETURNING hits')) return [{ hits: bucketHits[buckets++] ?? 1 }];
      if (sql.includes('SELECT id FROM users')) return existing ? [{ id: 8 }] : [];
      if (sql.includes('INSERT INTO users')) {
        calls.inserted = args;
        return [{ id: 21, name: args[0], email: args[1], password: args[2], role: 'user', auth_status: 'active', email_verified_at: null }];
      }
      return [{}];
    },
  };
  const db = { $transaction: async (fn) => fn(tx) };
  const sessions = { issue: async (user, transaction) => {
    calls.issued++;
    assert.equal(user.id, 21);
    assert.equal(transaction, tx);
    if (sessionError) throw sessionError;
    return { token: 'access', refreshToken: 'refresh' };
  } };
  const service = new DirectEmailSignupService(db, sessions, { JWT_SECRET: 'fixture-jwt-secret' });
  return { service, calls };
}

const signup = (overrides = {}) => ({
  name: '  강원  ', email: ' Owner@Example.COM ', password: 'Password123',
  passwordConfirm: 'Password123', agreeTerms: true, agreePrivacy: true,
  confirmAge14: true, consentVersion: SIGNUP_CONSENT_VERSION, turnstileToken: 'verified-before-service',
  ...overrides,
});

test('creates an email-unverified user, records consent, and issues session within one transaction', async () => {
  const { service, calls } = fixture();
  const result = await service.register(signup(), '203.0.113.10');
  assert.equal(calls.inserted[0], '강원');
  assert.equal(calls.inserted[1], 'owner@example.com');
  assert.equal(await bcrypt.compare('Password123', calls.inserted[2]), true);
  assert.equal(result.user.id, 21);
  assert.equal(result.token, 'access');
  assert.equal(calls.issued, 1);
  assert.match(calls.event[2], /direct-email-unverified/);
  assert.match(calls.event[2], /terms\+privacy:age14/);
});

test('refuses duplicate email without issuing a second account session', async () => {
  const { service, calls } = fixture({ existing: true });
  await assert.rejects(service.register(signup(), '203.0.113.10'), (error) => error.statusCode === 409);
  assert.equal(calls.issued, 0);
  assert.equal(calls.inserted, null);
});

test('rate-limits repeated signup attempts before revealing whether an email exists', async () => {
  const { service, calls } = fixture({ bucketHits: [4, 1] });
  await assert.rejects(service.register(signup(), '203.0.113.10'), (error) => error.statusCode === 429);
  assert.equal(calls.issued, 0);
  assert.equal(calls.inserted, null);
});

test('does not return a successful registration if session persistence fails', async () => {
  const { service, calls } = fixture({ sessionError: new Error('session storage unavailable') });
  await assert.rejects(service.register(signup(), '203.0.113.10'), /session storage unavailable/);
  assert.equal(calls.issued, 1);
});

test('rejects stale signup consent versions', async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.register(signup({ consentVersion: 'old' }), '203.0.113.10'), (error) => error.statusCode === 400);
  assert.equal(calls.inserted, null);
});


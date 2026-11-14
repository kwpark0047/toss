const { test } = require('node:test');
const assert = require('node:assert/strict');
const { testCheckoutConfig } = require('../utils/testCheckoutConfig');
test('only matching test key types enable the public test checkout', () => {
  assert.deepEqual(testCheckoutConfig({ TOSS_CLIENT_KEY: 'test_ck_qa', TOSS_SECRET_KEY: 'test_sk_qa' }), { enabled: true, clientKey: 'test_ck_qa' });
  for (const env of [{}, { TOSS_CLIENT_KEY: 'live_ck_x', TOSS_SECRET_KEY: 'live_sk_x' }, { TOSS_CLIENT_KEY: 'test_ck_x', TOSS_SECRET_KEY: 'live_sk_x' }, { TOSS_CLIENT_KEY: 'test_ck_x' }]) {
    assert.deepEqual(testCheckoutConfig(env), { enabled: false });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { OAuthProvider } = require('../../services/OAuthProvider');
const { publicConfig } = require('../../utils/freeAuthPolicy');
const env = { NODE_ENV:'development', FREE_AUTH_API_ORIGIN:'http://localhost:5340',
  GOOGLE_CLIENT_ID:'fixture', GOOGLE_CLIENT_SECRET:'fixture' };
test('Google login/link remain available but unsupported recent-auth is rejected before redirect', () => {
  const provider = new OAuthProvider(env);
  assert.equal(new URL(provider.authorization('google', {state:'state',nonce:'nonce',verifier:'verifier'})).hostname, 'accounts.google.com');
  assert.throws(() => provider.authorization('google', {state:'state',nonce:'nonce',verifier:'verifier',reauth:true}), /이메일.*재인증/);
  assert.equal(publicConfig(env).googleReauth, false);
});

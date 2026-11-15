// Return only a publishable TEST client key; never return any secret or live key.
function testCheckoutConfig(env = process.env) {
  const client = env.TOSS_CLIENT_KEY || '',
    secret = env.TOSS_SECRET_KEY || '';
  return /^test_ck_.+/.test(client) && /^test_sk_.+/.test(secret)
    ? { enabled: true, clientKey: client }
    : { enabled: false };
}
module.exports = { testCheckoutConfig };

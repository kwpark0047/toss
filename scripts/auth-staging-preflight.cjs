const fs = require('node:fs');
const dotenv = require('dotenv');
const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'KAKAO_REST_API_KEY',
  'KAKAO_CLIENT_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
  'MAIL_FROM', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'EMAIL_AUTH_PEPPER'];
function inspect(base, auth) {
  const db = new URL(base.DATABASE_URL);
  if (db.hostname !== '127.0.0.1' || db.port !== '55438' ||
      db.pathname !== '/wemarket_test_staging_20261010') throw Error('ISOLATED_STAGING_REQUIRED');
  const frontend = auth.FRONTEND_URL || 'http://localhost:5178';
  const api = auth.FREE_AUTH_API_ORIGIN || 'http://localhost:5340';
  for (const origin of [frontend, api]) {
    const url = new URL(origin);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.protocol !== 'http:' ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw Error('LOCAL_STAGING_ORIGIN_REQUIRED');
    }
  }
  const missing = required.filter(key => typeof auth[key] !== 'string' || !auth[key].trim());
  const invalid = [];
  if (auth.EMAIL_AUTH_PEPPER && auth.EMAIL_AUTH_PEPPER.length < 32) invalid.push('EMAIL_AUTH_PEPPER');
  if (auth.SMTP_PORT && !['465', '587'].includes(auth.SMTP_PORT)) invalid.push('SMTP_PORT');
  return { ready: !missing.length && !invalid.length, localOnly: true, frontend, api,
    missing, invalid, callbacks: ['google', 'kakao'].map(p => `${api}/api/auth/free/oauth/${p}/callback`),
    operatingConfigurationChanged: false, externalAuthenticationVerified: false };
}
if (require.main === module) {
  try {
    const base = dotenv.parse(fs.readFileSync('.env.staging.local'));
    const auth = fs.existsSync('.env.auth-staging.local')
      ? dotenv.parse(fs.readFileSync('.env.auth-staging.local')) : {};
    const result = inspect(base, auth);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 2;
  } catch { console.error('AUTH_STAGING_PREFLIGHT_FAILED'); process.exitCode = 1; }
}
module.exports = { inspect };


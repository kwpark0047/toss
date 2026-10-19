const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { inspect } = require('./auth-staging-preflight.cjs');
const root = path.resolve(__dirname, '..');
const base = dotenv.parse(fs.readFileSync(path.join(root, '.env.staging.local')));
const auth = dotenv.parse(fs.readFileSync(path.join(root, '.env.auth-staging.local')));
if (!inspect(base, auth).ready) throw Error('AUTH_STAGING_CONFIGURATION_REQUIRED');
const env = { ...process.env, ...base, ...auth,
  DATABASE_URL: base.DATABASE_URL, DIRECT_URL: base.DATABASE_URL, REPLICA_URL: base.DATABASE_URL,
  NODE_ENV: 'development', PORT: '5340', FRONTEND_URL: 'http://localhost:5178',
  CORS_ORIGIN: 'http://localhost:5178', FREE_AUTH_API_ORIGIN: 'http://localhost:5340',
  FREE_AUTH_ENABLED: 'true', AUTH_EMAIL_DAILY_BUDGET: '5', DOTENV_CONFIG_PATH: '.__auth_staging_no_default_env__',
  BILLING_SCHEDULER_ENABLED: 'false', WEBHOOK_RETRY_ENABLED: 'false',
  FREE_AUTH_MAINTENANCE_ENABLED: 'false', GEMINI_API_KEY: '', TOSS_SECRET_KEY: '',
  TOSS_CLIENT_KEY: '', SMS_API_KEY: '', SMS_API_SECRET: '', SMS_ENV: 'dev',
  FIREBASE_SERVICE_ACCOUNT_PATH: '', SUPABASE_SERVICE_ROLE_KEY: '', SENTRY_DSN: '',
  ALERT_WEBHOOK_URL: '', FREE_AUTH_TERMS_URL: '', FREE_AUTH_PRIVACY_URL: '' };
const backend = spawn(process.execPath, ['--import', 'tsx', 'scripts/auth-staging-server.mts'], { cwd: root, env, stdio: 'inherit' });
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', '5178', '--strictPort'], {
  cwd: path.join(root, 'frontend'), env: { ...env, VITE_API_URL: 'http://localhost:5340/api',
    VITE_SOCKET_URL: 'http://localhost:5340', VITE_TOSS_CLIENT_KEY: '' }, stdio: 'inherit' });
let stopping = false;
function stop() { if (stopping) return; stopping = true; backend.kill(); frontend.kill(); }
for (const child of [backend, frontend]) {
  child.on('error', () => { process.exitCode = 1; stop(); });
  child.on('exit', code => { if (!stopping) { process.exitCode = code || 1; stop(); } });
}
process.once('SIGINT', stop); process.once('SIGTERM', stop);


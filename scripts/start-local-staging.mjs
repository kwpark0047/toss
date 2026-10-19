import dotenv from 'dotenv';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = dotenv.config({ path: path.join(root, '.env.staging.local'), quiet: true }).parsed;
if (!config) throw new Error('STAGING_ENV_REQUIRED');
const db = new URL(config.DATABASE_URL);
if (db.hostname !== '127.0.0.1' || db.port !== '55438' || db.pathname !== '/wemarket_test_staging_20261010') throw new Error('ISOLATED_STAGING_REQUIRED');
if (!config.TOSS_CLIENT_KEY?.startsWith('test_') || !config.TOSS_SECRET_KEY?.startsWith('test_')) throw new Error('TEST_KEYS_REQUIRED');
const running = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore', timeout: 10000 });
const dockerSteps = running.status === 0 ? [['start', 'wemarket-p0-audit-20261008']] : [['desktop', 'start'], ['start', 'wemarket-p0-audit-20261008']];
for (const args of dockerSteps) {
  const result = spawnSync('docker', args, { stdio: 'inherit', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error('STAGING_DOCKER_START_FAILED');
}
const env = { ...process.env, ...config, DATABASE_URL: db.href, DIRECT_URL: db.href, REPLICA_URL: db.href,
  DOTENV_CONFIG_PATH: '.__staging_no_default_env__', NODE_ENV: 'development', PORT: '5300', APP_COMMIT_SHA: '',
  BILLING_SCHEDULER_ENABLED: 'false', WEBHOOK_RETRY_ENABLED: 'false', GEMINI_API_KEY: '',
  FIREBASE_SERVICE_ACCOUNT_PATH: '', SMS_API_KEY: '', SMS_API_SECRET: '', ALERT_WEBHOOK_URL: '' };
const backend = spawn(process.execPath, ['--import', 'tsx', 'index.mts'], { cwd: root, env, stdio: 'inherit' });
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  cwd: path.join(root, 'frontend'), env: { ...process.env, VITE_API_URL: 'http://localhost:5300/api', VITE_SOCKET_URL: 'http://localhost:5300', VITE_TOSS_CLIENT_KEY: '', APP_COMMIT_SHA: '' }, stdio: 'inherit',
});
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; backend.kill(); frontend.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (const child of [backend, frontend]) {
  child.on('error', () => { process.exitCode = 1; stop(); });
  child.on('exit', code => { if (!stopping) { process.exitCode = code || 1; stop(); } });
}


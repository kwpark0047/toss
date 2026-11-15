const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertLabLaunch, DATABASE_URL } = require('./mobile-push-lab-guard.cjs');
const root = path.resolve(__dirname, '..');
const flag = ['--isolated-test-only'];
assert.doesNotThrow(() => assertLabLaunch(flag, { DATABASE_URL }));
for (const env of [
  { NODE_ENV: 'production' },
  { RENDER: 'true' },
  { VERCEL: '1' },
  { CF_PAGES: '1' },
  { DATABASE_URL: 'postgresql://other.invalid/live' },
  { DIRECT_URL: 'postgresql://other.invalid/live' },
  { REPLICA_URL: 'postgresql://other.invalid/live' },
]) {
  assert.throws(() => assertLabLaunch(flag, env));
}
// Execute the real launcher: these cases must exit before reading fixtures,
// opening listeners, connecting any database, or spawning the tunnel/API.
for (const sample of [
  { args: [], env: {}, message: 'ISOLATED_TEST_FLAG_REQUIRED' },
  {
    args: flag,
    env: { NODE_ENV: 'production' },
    message: 'HOSTED_OR_PRODUCTION_ENVIRONMENT_FORBIDDEN',
  },
  {
    args: flag,
    env: { DATABASE_URL: 'postgresql://other.invalid/live' },
    message: 'NON_LAB_DATABASE_ENVIRONMENT_FORBIDDEN',
  },
]) {
  const run = spawnSync(
    process.execPath,
    [path.join(__dirname, 'mobile-push-lab.cjs'), ...sample.args],
    {
      cwd: root,
      env: { ...process.env, ...sample.env },
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    }
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(sample.message));
  assert.ok(!run.stdout.includes('READY'));
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
for (const name of ['start', 'build', 'postinstall', 'vercel-build'])
  assert.doesNotMatch(manifest.scripts[name], /mobile-push-lab/);
for (const file of [
  'index.mts',
  'app.mts',
  'routes/orders.js',
  'services/OrderWebPushService.js',
  'render.yaml',
  'Dockerfile',
]) {
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, file), 'utf8'),
    /mobile-push-lab|lab_auto_ready_at|AUTO_READY_MS/
  );
}
const ignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
for (const entry of [
  '.tmp/',
  'scripts/mobile-push-lab*.cjs',
  'scripts/prepare-mobile-push-lab.cjs',
])
  assert.ok(ignore.split(/\r?\n/).includes(entry));
console.log(
  'PASS: actual launcher refuses production/hosted/non-lab DB environments; production entry points unchanged'
);

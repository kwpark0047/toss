const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('tsx and CommonJS share cache ownership and close all resources', () => {
  const result = spawnSync(process.execPath,
    ['--import', 'tsx', 'tests/fixtures/cache-module-boundary.mts'],
    // This starts a fresh Node+tsx process; CI can be heavily loaded while the
    // remaining suite runs concurrently. Keep a finite but realistic ceiling.
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
      env: { ...process.env, REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' } });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stderr}`);
});



const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('tsx and CommonJS share cache ownership and close all resources', () => {
  const result = spawnSync(process.execPath,
    ['--import', 'tsx', 'tests/fixtures/cache-module-boundary.mts'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 8000,
      env: { ...process.env, REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' } });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stderr}`);
});


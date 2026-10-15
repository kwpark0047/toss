const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('tsx and CommonJS share cache ownership and close all resources', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { getRedisCache } from './utils/redisCache.js';
    import { hybridCache } from './utils/cache.js';
    const require = createRequire(import.meta.url);
    try {
      assert.equal(getRedisCache(), require('./utils/redisCache.js').getRedisCache());
      assert.equal(hybridCache, require('./utils/cache.js').hybridCache);
      assert.equal(typeof hybridCache.close, 'function');
    } finally {
      await require('./utils/runtimeResources.js').closeRuntimeResources();
    }
  `;
  const result = spawnSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', source],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 8000,
      env: { ...process.env, REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' } });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stderr}`);
});


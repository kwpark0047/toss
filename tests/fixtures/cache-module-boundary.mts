import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getRedisCache } from '../../utils/redisCache.js';
import { hybridCache } from '../../utils/cache.js';
const require = createRequire(import.meta.url);
try {
  assert.equal(getRedisCache(), require('../../utils/redisCache.js').getRedisCache());
  assert.equal(hybridCache, require('../../utils/cache.js').hybridCache);
  assert.equal(typeof hybridCache.close, 'function');
} finally {
  await require('../../utils/runtimeResources.js').closeRuntimeResources();
}

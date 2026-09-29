const { getRedisCache } = require('../utils/redisCache');

function getRedis() {
  const cache = getRedisCache();
  return cache.isConnected ? cache.client : null;
}

module.exports = { getRedis };

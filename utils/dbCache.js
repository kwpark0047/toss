const NodeCache = require('node-cache');
const redisCache = require('./redisCache');
const logger = require('./logger');

class DbCache {
    constructor(ttlSeconds = 300) {
        this.ttl = ttlSeconds;
        this.nodeCache = new NodeCache({
            stdTTL: ttlSeconds,
            checkperiod: 60,
            useClones: false
        });
        this.redisReady = false;
        this._initRedis();
    }

    async _initRedis() {
        try {
            const connected = await redisCache.connect();
            if (connected) {
                this.redisReady = true;
                logger.info('[DbCache] Redis connected');
            }
        } catch (_err) {
            logger.warn('[DbCache] Redis unavailable, using NodeCache only');
        }
    }

    set(key, value, ttl) {
        logger.debug(`[DbCache] Cache Set: ${key}`);
        const result = this.nodeCache.set(key, value, ttl);
        if (this.redisReady) {
            redisCache.set(key, value, ttl || this.ttl).catch(() => {});
        }
        return result;
    }

    get(key) {
        const value = this.nodeCache.get(key);
        if (value !== undefined) {
            logger.debug(`[DbCache] Cache Hit: ${key}`);
        }
        return value;
    }

    del(key) {
        logger.debug(`[DbCache] Cache Evicted: ${key}`);
        const result = this.nodeCache.del(key);
        if (this.redisReady) {
            redisCache.del(key).catch(() => {});
        }
        return result;
    }

    flushByStore(storeId) {
        const keys = this.nodeCache.keys();
        const storeKeys = keys.filter(k => k.includes(`store:${storeId}`));
        if (storeKeys.length > 0) {
            this.nodeCache.del(storeKeys);
            logger.info(`[DbCache] Flushed ${storeKeys.length} cached query buffers for Store ${storeId}`);
        }
        if (this.redisReady) {
            redisCache.flushByStore(storeId).catch(() => {});
        }
    }

    flushAll() {
        logger.info('[DbCache] Complete Flush All.');
        const result = this.nodeCache.flushAll();
        if (this.redisReady) {
            redisCache.flushAll().catch(() => {});
        }
        return result;
    }
}

module.exports = new DbCache();

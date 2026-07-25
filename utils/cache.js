const NodeCache = require('node-cache');
const redisCache = require('./redisCache');
const logger = require('./logger');

class Cache {
    constructor(ttlSeconds = 300) {
        this.ttl = ttlSeconds;
        this.nodeCache = new NodeCache({
            stdTTL: ttlSeconds,
            checkperiod: ttlSeconds * 0.2,
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
                logger.info('[Cache] Redis connected');
            }
        } catch (_err) {
            logger.warn('[Cache] Redis unavailable, using NodeCache only');
        }
    }

    set(key, value, ttl) {
        const result = this.nodeCache.set(key, value, ttl);
        if (this.redisReady) {
            redisCache.set(key, value, ttl || this.ttl).catch(() => {});
        }
        return result;
    }

    get(key) {
        return this.nodeCache.get(key);
    }

    del(key) {
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
        }
        if (this.redisReady) {
            redisCache.flushByStore(storeId).catch(() => {});
        }
    }

    flushAll() {
        const result = this.nodeCache.flushAll();
        if (this.redisReady) {
            redisCache.flushAll().catch(() => {});
        }
        return result;
    }
}

module.exports = new Cache();

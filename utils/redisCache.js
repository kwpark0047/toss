const { createClient } = require('redis');
const logger = require('./logger');

class RedisCache {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.defaultTTL = 300;
    }

    async connect() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            logger.warn('[RedisCache] REDIS_URL not set, Redis caching disabled');
            return false;
        }

        try {
            this.client = createClient({ url: redisUrl });
            this.client.on('error', (err) => {
                logger.error('[RedisCache] Connection error:', err.message);
                this.isConnected = false;
            });
            this.client.on('connect', () => {
                logger.info('[RedisCache] Connected');
                this.isConnected = true;
            });
            await this.client.connect();
            return true;
        } catch (err) {
            logger.error('[RedisCache] Failed to connect:', err.message);
            return false;
        }
    }

    async set(key, value, ttl) {
        if (!this.isConnected) return false;
        const expiry = ttl || this.defaultTTL;
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, expiry, serialized);
        return true;
    }

    async get(key) {
        if (!this.isConnected) return undefined;
        const value = await this.client.get(key);
        if (value === null) return undefined;
        return JSON.parse(value);
    }

    async del(key) {
        if (!this.isConnected) return 0;
        return await this.client.del(key);
    }

    async flushByStore(storeId) {
        if (!this.isConnected) return;
        const pattern = `*store:${storeId}*`;
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
            logger.info(`[RedisCache] Flushed ${keys.length} keys for store ${storeId}`);
        }
    }

    async flushAll() {
        if (!this.isConnected) return;
        await this.client.flushAll();
        logger.info('[RedisCache] Flushed all keys');
    }
}

module.exports = new RedisCache();

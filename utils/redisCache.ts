import Redis from 'ioredis';
import logger from './logger.js';

export class RedisCache {
  private options: any;
  private client: any;
  private subscriber: any;
  private isConnected: boolean;
  private localCache: Map<string, any>;
  private localCacheMaxSize: number;

  constructor(options: any = {}) {
    this.options = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT) || 6379,
      password: options.password || process.env.REDIS_PASSWORD || undefined,
      db: options.db || parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: options.keyPrefix || 'wemarket:',
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      lazyConnect: true,
      ...options,
    };

    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
    this.localCache = new Map();
    this.localCacheMaxSize = 1000;
  }

  async connect(): Promise<any> {
    if (this.client) return this.client;

    this.client = new Redis(this.options);
    this.subscriber = new Redis(this.options);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('[RedisCache] Connected to Redis');
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      logger.error('[RedisCache] Connection error', { error: err.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('[RedisCache] Connection closed');
    });

    await this.subscriber.subscribe('wemarket:cache:invalidate', (err: Error | null) => {
      if (err) logger.error('[RedisCache] Subscribe error', { error: err.message });
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      if (channel === 'wemarket:cache:invalidate') {
        this.handleInvalidationMessage(message);
      }
    });

    await this.client.connect();
    return this.client;
  }

  handleInvalidationMessage(message: string): void {
    try {
      const { tags, pattern } = JSON.parse(message);
      if (tags) {
        tags.forEach(tag => this.invalidateLocalCacheByTag(tag));
      }
      if (pattern) {
        this.invalidateLocalCacheByPattern(pattern);
      }
    } catch (err: any) {
      logger.warn('[RedisCache] Invalid invalidation message', { error: err.message });
    }
  }

  buildKey(domain: string, entity: string, id: string | number, suffix = ''): string {
    const parts = [this.options.keyPrefix, domain, entity, id];
    if (suffix) parts.push(suffix);
    return parts.join(':');
  }

  buildTagKey(tag: string): string {
    return `${this.options.keyPrefix}tag:${tag}`;
  }

  async get(key: string): Promise<any> {
    if (this.localCache.has(key)) {
      const entry = this.localCache.get(key);
      if (entry.expiry > Date.now()) {
        return entry.value;
      }
      this.localCache.delete(key);
    }

    if (!this.isConnected) {
      logger.warn('[RedisCache] Not connected, skipping Redis get');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value !== null) {
        const parsed = JSON.parse(value);
        this.setLocalCache(key, parsed, 5 * 60 * 1000);
        return parsed;
      }
      return null;
    } catch (err) {
      logger.error('[RedisCache] Get error', { key, error: err.message });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<boolean> {
    const serialized = JSON.stringify(value);

    this.setLocalCache(key, value, Math.min(ttlSeconds, 300) * 1000);

    if (!this.isConnected) {
      logger.warn('[RedisCache] Not connected, skipping Redis set');
      return false;
    }

    try {
      if (ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (err) {
      logger.error('[RedisCache] Set error', { key, error: err.message });
      return false;
    }
  }

  async setWithTags(key: string, value: any, ttlSeconds = 300, tags: string[] = []): Promise<boolean> {
    await this.set(key, value, ttlSeconds);

    if (tags.length === 0) return true;

    const tagKeys = tags.map(tag => this.buildTagKey(tag));
    const pipeline = this.client.pipeline();
    tagKeys.forEach(tagKey => {
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, ttlSeconds + 60);
    });
    await pipeline.exec();

    return true;
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    if (tags.length === 0) return 0;

    const tagKeys = tags.map(tag => this.buildTagKey(tag));
    let totalInvalidated = 0;

    for (const tagKey of tagKeys) {
      const keys = await this.client.smembers(tagKey);
      if (keys.length > 0) {
        await this.client.del(...keys);
        totalInvalidated += keys.length;
      }
      await this.client.del(tagKey);
    }

    await this.publishInvalidation({ tags });

    tags.forEach(tag => this.invalidateLocalCacheByTag(tag));

    logger.info('[RedisCache] Invalidated by tags', { tags, count: totalInvalidated });
    return totalInvalidated;
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    const fullPattern = `${this.options.keyPrefix}${pattern}`;
    let cursor = '0';
    let totalInvalidated = 0;

    do {
      const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
        totalInvalidated += keys.length;
      }
    } while (cursor !== '0');

    await this.publishInvalidation({ pattern });
    this.invalidateLocalCacheByPattern(pattern);

    logger.info('[RedisCache] Invalidated by pattern', { pattern, count: totalInvalidated });
    return totalInvalidated;
  }

  async publishInvalidation({ tags, pattern }: { tags?: string[]; pattern?: string }): Promise<void> {
    try {
      await this.subscriber.publish('wemarket:cache:invalidate', JSON.stringify({ tags, pattern }));
    } catch (err) {
      logger.warn('[RedisCache] Publish invalidation failed', { error: err.message });
    }
  }

  setLocalCache(key: string, value: any, ttlMs: number): void {
    if (this.localCache.size >= this.localCacheMaxSize) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
    this.localCache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidateLocalCacheByTag(tag: string): void {
    const tagPrefix = `${this.options.keyPrefix}tag:${tag}`;
    for (const [key] of this.localCache) {
      if (key.startsWith(tagPrefix) || key.includes(`:${tag}:`)) {
        this.localCache.delete(key);
      }
    }
  }

  invalidateLocalCacheByPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const [key] of this.localCache) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }
  }

  async has(key: string): Promise<boolean> {
    if (this.localCache.has(key)) return true;
    if (!this.isConnected) return false;
    try {
      return await this.client.exists(key) === 1;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    this.localCache.delete(key);
    if (!this.isConnected) return false;
    try {
      return await this.client.del(key) > 0;
    } catch {
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      return await this.client.expire(key, ttlSeconds) === 1;
    } catch {
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) return -2;
    try {
      return await this.client.ttl(key);
    } catch {
      return -2;
    }
  }

  async healthCheck(): Promise<any> {
    if (!this.isConnected) return { status: 'disconnected' };
    try {
      const start = Date.now();
      await this.client.ping();
      return {
        status: 'healthy',
        latency: Date.now() - start,
        localCacheSize: this.localCache.size,
      };
    } catch (err) {
      return { status: 'unhealthy', error: err.message };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnected = false;
    this.localCache.clear();
  }
}

let redisCacheInstance: RedisCache | null = null;

export function getRedisCache(options?: any): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache(options);
  }
  return redisCacheInstance;
}

export const legacyCacheAdapter = {
  get: async (key: string) => {
    const cache = getRedisCache();
    return cache.get(key);
  },
  set: async (key: string, value: any, ttl = 300) => {
    const cache = getRedisCache();
    return cache.set(key, value, ttl);
  },
  del: async (key: string) => {
    const cache = getRedisCache();
    return cache.del(key);
  },
  flush: async () => {
    const cache = getRedisCache();
    await cache.invalidateByPattern('*');
  },
  getStats: () => ({
    type: 'redis',
    connected: getRedisCache().isConnected,
  }),
};

export { RedisCache, getRedisCache };
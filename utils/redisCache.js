/**
 * Redis 분산 캐시 서비스
 * 단일 프로세스 NodeCache → Redis 클러스터 대응
 * - TTL 기반 만료
 * - 태그 기반 무효화 (Pub/Sub)
 * - 키 네이밍 컨벤션: wemarket:{domain}:{entity}:{id}
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisCache {
  constructor(options = {}) {
    this.options = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT) || 6379,
      password: options.password || process.env.REDIS_PASSWORD || undefined,
      db: options.db || parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: options.keyPrefix || 'wemarket:',
      // 연결 풀 설정
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      lazyConnect: true,
      ...options,
    };

    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
    this.localCache = new Map(); // L1 캐시 (최근 접근 키)
    this.localCacheMaxSize = 1000;
  }

  /**
   * Redis 연결 초기화
   */
  async connect() {
    if (this.client) return this.client;

    this.client = new Redis(this.options);
    this.subscriber = new Redis(this.options);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('[RedisCache] Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error('[RedisCache] Connection error', { error: err.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('[RedisCache] Connection closed');
    });

    // 태그 무효화용 Pub/Sub 구독
    await this.subscriber.subscribe('wemarket:cache:invalidate', (err) => {
      if (err) logger.error('[RedisCache] Subscribe error', { error: err.message });
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === 'wemarket:cache:invalidate') {
        this.handleInvalidationMessage(message);
      }
    });

    await this.client.connect();
    return this.client;
  }

  /**
   * 무효화 메시지 처리 (다른 인스턴스에서 발행한 태그 무효화)
   */
  handleInvalidationMessage(message) {
    try {
      const { tags, pattern } = JSON.parse(message);
      if (tags) {
        tags.forEach(tag => this.invalidateLocalCacheByTag(tag));
      }
      if (pattern) {
        this.invalidateLocalCacheByPattern(pattern);
      }
    } catch (err) {
      logger.warn('[RedisCache] Invalid invalidation message', { error: err.message });
    }
  }

  /**
   * 키 생성 (네이밍 컨벤션 준수)
   */
  buildKey(domain, entity, id, suffix = '') {
    const parts = [this.options.keyPrefix, domain, entity, id];
    if (suffix) parts.push(suffix);
    return parts.join(':');
  }

  /**
   * 태그 키 생성
   */
  buildTagKey(tag) {
    return `${this.options.keyPrefix}tag:${tag}`;
  }

  /**
   * 값 조회 (L1 → Redis 순서)
   */
  async get(key) {
    // L1 캐시 확인
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
        // L1 캐시에 저장 (5분 TTL)
        this.setLocalCache(key, parsed, 5 * 60 * 1000);
        return parsed;
      }
      return null;
    } catch (err) {
      logger.error('[RedisCache] Get error', { key, error: err.message });
      return null;
    }
  }

  /**
   * 값 저장 (Redis + L1 캐시)
   */
  async set(key, value, ttlSeconds = 300) {
    const serialized = JSON.stringify(value);

    // L1 캐시
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

  /**
   * 태그와 함께 저장 (태그 기반 무효화 지원)
   */
  async setWithTags(key, value, ttlSeconds = 300, tags = []) {
    await this.set(key, value, ttlSeconds);

    if (tags.length === 0) return true;

    // 태그-키 매핑 저장
    const tagKeys = tags.map(tag => this.buildTagKey(tag));
    const pipeline = this.client.pipeline();
    tagKeys.forEach(tagKey => {
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, ttlSeconds + 60); // 태그 키는 데이터보다 조금 더 길게
    });
    await pipeline.exec();

    return true;
  }

  /**
   * 태그로 키 무효화 (클러스터 전체 전파)
   */
  async invalidateByTags(tags) {
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

    // 클러스터 다른 인스턴스에 무효화 발행
    await this.publishInvalidation({ tags });

    // 로컬 캐시도 무효화
    tags.forEach(tag => this.invalidateLocalCacheByTag(tag));

    logger.info('[RedisCache] Invalidated by tags', { tags, count: totalInvalidated });
    return totalInvalidated;
  }

  /**
   * 패턴으로 키 무효화
   */
  async invalidateByPattern(pattern) {
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

    // 클러스터 전파
    await this.publishInvalidation({ pattern });
    this.invalidateLocalCacheByPattern(pattern);

    logger.info('[RedisCache] Invalidated by pattern', { pattern, count: totalInvalidated });
    return totalInvalidated;
  }

  /**
   * 무효화 메시지 발행 (Pub/Sub)
   */
  async publishInvalidation({ tags, pattern }) {
    try {
      await this.subscriber.publish('wemarket:cache:invalidate', JSON.stringify({ tags, pattern }));
    } catch (err) {
      logger.warn('[RedisCache] Publish invalidation failed', { error: err.message });
    }
  }

  /**
   * 로컬 캐시 (L1) 관리
   */
  setLocalCache(key, value, ttlMs) {
    // LRU 크기 제한
    if (this.localCache.size >= this.localCacheMaxSize) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
    this.localCache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidateLocalCacheByTag(tag) {
    const tagPrefix = `${this.options.keyPrefix}tag:${tag}`;
    for (const [key] of this.localCache) {
      if (key.startsWith(tagPrefix) || key.includes(`:${tag}:`)) {
        this.localCache.delete(key);
      }
    }
  }

  invalidateLocalCacheByPattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const [key] of this.localCache) {
      if (regex.test(key)) {
        this.localCache.delete(key);
      }
    }
  }

  /**
   * 키 존재 확인
   */
  async has(key) {
    if (this.localCache.has(key)) return true;
    if (!this.isConnected) return false;
    try {
      return await this.client.exists(key) === 1;
    } catch {
      return false;
    }
  }

  /**
   * 키 삭제
   */
  async del(key) {
    this.localCache.delete(key);
    if (!this.isConnected) return false;
    try {
      return await this.client.del(key) > 0;
    } catch {
      return false;
    }
  }

  /**
   * TTL 연장
   */
  async expire(key, ttlSeconds) {
    if (!this.isConnected) return false;
    try {
      return await this.client.expire(key, ttlSeconds) === 1;
    } catch {
      return false;
    }
  }

  /**
   * TTL 조회
   */
  async ttl(key) {
    if (!this.isConnected) return -2;
    try {
      return await this.client.ttl(key);
    } catch {
      return -2;
    }
  }

  /**
   * 헬스 체크
   */
  async healthCheck() {
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

  /**
   * 연결 종료
   */
  async disconnect() {
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

// 싱글톤 인스턴스
let redisCacheInstance = null;

/**
 * RedisCache 싱글톤 가져오기
 */
function getRedisCache(options) {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache(options);
  }
  return redisCacheInstance;
}

/**
 * 기존 cache.js 인터페이스 호환 래퍼 (점진적 마이그레이션용)
 */
const legacyCacheAdapter = {
  get: async (key) => {
    const cache = getRedisCache();
    return cache.get(key);
  },
  set: async (key, value, ttl = 300) => {
    const cache = getRedisCache();
    return cache.set(key, value, ttl);
  },
  del: async (key) => {
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

module.exports = {
  RedisCache,
  getRedisCache,
  legacyCacheAdapter,
};
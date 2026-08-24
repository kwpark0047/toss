/**
 * 통합 캐시 서비스 — Redis (분산) + NodeCache (L1) 하이브리드
 * - NodeCache: 프로세스 로컬 L1 캐시 (초고속, 5분 TTL)
 * - Redis: 분산 L2 캐시 (클러스터 공유, 태그 무효화, 영속성)
 * - 레거시 Cache 인터페이스 유지 (점진적 마이그레이션)
 */

const NodeCache = require('node-cache');
const { getRedisCache, legacyCacheAdapter } = require('./redisCache');
const logger = require('./logger');

class HybridCache {
  constructor(ttlSeconds = 300) {
    this.defaultTtl = ttlSeconds;
    this.nodeCache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false,
      maxKeys: 10000,
    });
    this.redisCache = null;
    this.redisReady = false;
    this._initRedis();
  }

  async _initRedis() {
    try {
      this.redisCache = getRedisCache();
      await this.redisCache.connect();
      this.redisReady = true;
      logger.info('[HybridCache] Redis connected');
    } catch (err) {
      logger.warn('[HybridCache] Redis unavailable, using NodeCache only', { error: err.message });
      this.redisReady = false;
    }
  }

  /**
   * 값 조회 (L1 → L2 순서)
   */
  async get(key) {
    // L1 (NodeCache)
    const localValue = this.nodeCache.get(key);
    if (localValue !== undefined) return localValue;

    // L2 (Redis)
    if (this.redisReady && this.redisCache) {
      try {
        const value = await this.redisCache.get(key);
        if (value !== null) {
          // L1에 승격 (짧은 TTL)
          this.nodeCache.set(key, value, Math.min(this.defaultTtl, 300));
          return value;
        }
      } catch (err) {
        logger.warn('[HybridCache] Redis get error', { key, error: err.message });
      }
    }
    return undefined;
  }

  /**
   * 값 저장 (L1 + L2 동시)
   */
  async set(key, value, ttl = this.defaultTtl) {
    // L1
    this.nodeCache.set(key, value, ttl);

    // L2
    if (this.redisReady && this.redisCache) {
      try {
        await this.redisCache.set(key, value, ttl);
      } catch (err) {
        logger.warn('[HybridCache] Redis set error', { key, error: err.message });
      }
    }
    return true;
  }

  /**
   * 태그와 함께 저장 (무효화 지원)
   */
  async setWithTags(key, value, ttl = this.defaultTtl, tags = []) {
    await this.set(key, value, ttl);
    if (this.redisReady && this.redisCache && tags.length > 0) {
      try {
        await this.redisCache.setWithTags(key, value, ttl, tags);
      } catch (err) {
        logger.warn('[HybridCache] Redis setWithTags error', { key, error: err.message });
      }
    }
  }

  /**
   * 키 삭제 (L1 + L2)
   */
  async del(key) {
    this.nodeCache.del(key);
    if (this.redisReady && this.redisCache) {
      try {
        await this.redisCache.del(key);
      } catch (err) {
        logger.warn('[HybridCache] Redis del error', { key, error: err.message });
      }
    }
    return true;
  }

  /**
   * 매장 관련 키 일괄 삭제 (태그 기반)
   */
  async flushByStore(storeId) {
    // L1: 키 패턴 매칭 삭제
    const keys = this.nodeCache.keys();
    const storeKeys = keys.filter(k => k.includes(`store:${storeId}`) || k.includes(`:store:${storeId}`));
    if (storeKeys.length > 0) {
      this.nodeCache.del(storeKeys);
    }

    // L2: 태그 기반 무효화
    if (this.redisReady && this.redisCache) {
      try {
        await this.redisCache.invalidateByTags([`store:${storeId}`]);
      } catch (err) {
        logger.warn('[HybridCache] Redis flushByStore error', { storeId, error: err.message });
      }
    }
  }

  /**
   * 패턴으로 무효화
   */
  async invalidateByPattern(pattern) {
    // L1
    const keys = this.nodeCache.keys();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const matchedKeys = keys.filter(k => regex.test(k));
    if (matchedKeys.length > 0) {
      this.nodeCache.del(matchedKeys);
    }

    // L2
    if (this.redisReady && this.redisCache) {
      try {
        await this.redisCache.invalidateByPattern(pattern);
      } catch (err) {
        logger.warn('[HybridCache] Redis invalidateByPattern error', { pattern, error: err.message });
      }
    }
  }

  /**
   * 전체 플러시
   */
  async flushAll() {
    this.nodeCache.flushAll();
    if (this.redisReady && this.redisCache) {
      try {
        await this.redisCache.invalidateByPattern('*');
      } catch (err) {
        logger.warn('[HybridCache] Redis flushAll error', { error: err.message });
      }
    }
    return true;
  }

  /**
   * 통계 정보
   */
  getStats() {
    return {
      nodeCache: {
        keys: this.nodeCache.keys().length,
        hits: this.nodeCache.getStats().hits,
        misses: this.nodeCache.getStats().misses,
        ksize: this.nodeCache.getStats().ksize,
      },
      redis: {
        ready: this.redisReady,
        connected: this.redisCache?.isConnected || false,
      },
    };
  }

  /**
   * 헬스 체크
   */
  async healthCheck() {
    const redisHealth = this.redisReady && this.redisCache
      ? await this.redisCache.healthCheck()
      : { status: 'disabled' };
    return {
      nodeCache: { status: 'healthy', keys: this.nodeCache.keys().length },
      redis: redisHealth,
    };
  }
}

// 싱글톤 인스턴스
const hybridCache = new HybridCache();

// 레거시 호환: 기존 Cache 인터페이스 (동기 메서드)
const legacyCache = {
  set: (key, value, ttl) => hybridCache.set(key, value, ttl),
  get: (key) => hybridCache.get(key),
  del: (key) => hybridCache.del(key),
  flushByStore: (storeId) => hybridCache.flushByStore(storeId),
  flushAll: () => hybridCache.flushAll(),
  // 비동기 버전도 노출
  async: {
    get: (key) => hybridCache.get(key),
    set: (key, value, ttl) => hybridCache.set(key, value, ttl),
    setWithTags: (key, value, ttl, tags) => hybridCache.setWithTags(key, value, ttl, tags),
    del: (key) => hybridCache.del(key),
    flushByStore: (storeId) => hybridCache.flushByStore(storeId),
    invalidateByPattern: (pattern) => hybridCache.invalidateByPattern(pattern),
    flushAll: () => hybridCache.flushAll(),
    healthCheck: () => hybridCache.healthCheck(),
    getStats: () => hybridCache.getStats(),
  },
};

module.exports = legacyCache;
module.exports.HybridCache = HybridCache;
module.exports.hybridCache = hybridCache;
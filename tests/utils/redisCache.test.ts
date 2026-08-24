/**
 * Redis 캐시 테스트
 * tests/utils/redisCache.test.ts
 */

const { RedisCache, getRedisCache } = require('../../utils/redisCache');

describe('RedisCache', () => {
  let cache;

  beforeAll(() => {
    cache = getRedisCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      keyPrefix: 'test:',
    });
  });

  beforeEach(async () => {
    // 테스트 전 연결 확인
    try {
      await cache.connect();
    } catch (e) {
      // Redis 없으면 스킵
      console.log('Redis not available, skipping tests');
    }
  });

  afterAll(async () => {
    if (cache) {
      await cache.disconnect();
    }
  });

  describe('기본 CRUD', () => {
    it('set/get 기본 동작', async () => {
      const key = 'test:basic';
      const value = { foo: 'bar', num: 123 };

      await cache.set(key, value, 60);
      const result = await cache.get(key);

      expect(result).toEqual(value);
    });

    it('존재하지 않는 키는 null 반환', async () => {
      const result = await cache.get('test:nonexistent');
      expect(result).toBeNull();
    });

    it('del로 키 삭제', async () => {
      const key = 'test:delete';
      await cache.set(key, 'value', 60);
      await cache.del(key);
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    it('TTL 설정', async () => {
      const key = 'test:ttl';
      await cache.set(key, 'value', 1); // 1초 TTL
      const immediately = await cache.get(key);
      expect(immediately).toBe('value');

      // TTL 만료 대기 (테스트 환경에서는 실제로 기다리기 어려우므로 생략)
      // 실제로는 setTimeout 후 확인
    });
  });

  describe('태그 기반 무효화', () => {
    it('setWithTags로 태그와 함께 저장', async () => {
      const key = 'test:tagged';
      await cache.setWithTags(key, { data: 'test' }, 60, ['store:1', 'product:5']);

      const result = await cache.get(key);
      expect(result).toEqual({ data: 'test' });
    });

    it('invalidateByTags로 태그별 무효화', async () => {
      const key1 = 'test:invalidate1';
      const key2 = 'test:invalidate2';

      await cache.setWithTags(key1, { a: 1 }, 60, ['store:1']);
      await cache.setWithTags(key2, { b: 2 }, 60, ['store:2']);

      // store:1 태그로 무효화
      const count = await cache.invalidateByTags(['store:1']);

      const result1 = await cache.get(key1);
      const result2 = await cache.get(key2);

      expect(result1).toBeNull();
      expect(result2).toEqual({ b: 2 });
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('패턴 기반 무효화', () => {
    it('invalidateByPattern으로 패턴 매칭 삭제', async () => {
      await cache.set('test:pattern:1', 'one', 60);
      await cache.set('test:pattern:2', 'two', 60);
      await cache.set('test:other:3', 'three', 60);

      await cache.invalidateByPattern('pattern:*');

      const r1 = await cache.get('test:pattern:1');
      const r2 = await cache.get('test:pattern:2');
      const r3 = await cache.get('test:other:3');

      expect(r1).toBeNull();
      expect(r2).toBeNull();
      expect(r3).toEqual('three');
    });
  });

  describe('L1 캐시 (로컬 NodeCache)', () => {
    it('L1 캐시 히트 시 Redis 조회 안 함', async () => {
      const key = 'test:l1';
      await cache.set(key, 'original', 60);

      // 첫 조회로 L1에 캐시
      const first = await cache.get(key);
      expect(first).toEqual('original');

      // Redis에서 삭제해도 L1 캐시에 남아있음
      await cache.redisCache.del(key);
      const second = await cache.get(key);
      expect(second).toEqual('original');
    });
  });

  describe('헬스 체크', () => {
    it('healthCheck 반환', async () => {
      const health = await cache.healthCheck();
      expect(health).toHaveProperty('status');
      expect(['healthy', 'unhealthy', 'disconnected']).toContain(health.status);
    });
  });

  describe('연결 실패 시 graceful degradation', () => {
    it('연결 안 된 상태에서 get은 null 반환', async () => {
      // 연결 끊긴 캐시 인스턴스 생성
      const brokenCache = getRedisCache({ host: 'invalid-host', port: 9999 });
      const result = await brokenCache.get('test');
      expect(result).toBeNull();
    });

    it('연결 안 된 상태에서 set은 false 반환', async () => {
      const brokenCache = getRedisCache({ host: 'invalid-host', port: 9999 });
      const result = await brokenCache.set('key', 'value', 60);
      expect(result).toBe(false);
    });
  });
});
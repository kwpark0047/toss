const NodeCache = require('node-cache');
const logger = require('./logger');

/**
 * WeMarket 고성능 데이터베이스 쿼리 메모리 캐시 (DbCache)
 * 카테고리, 메뉴 리스트 및 점포 설정 데이터베이스 조회의 서브 밀리초(0~2ms) 가속을 담당합니다.
 */
class DbCache {
    constructor(ttlSeconds = 300) {
        this.cache = new NodeCache({
            stdTTL: ttlSeconds, // 기본 유지 시간: 5분
            checkperiod: 60,   // 만료 확인 주기: 1분
            useClones: false   // 성능 극대화를 위해 클론 복사 생략 (메모리 주소값 직접 참조)
        });
    }

    // [데이터 저장]
    set(key, value, ttl) {
        logger.debug(`⚡ [DbCache] Cache Set: ${key}`);
        return this.cache.set(key, value, ttl);
    }

    // [데이터 조회]
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger.debug(`⚡ [DbCache] Cache Hit: ${key}`);
        }
        return value;
    }

    // [단일 데이터 소거]
    del(key) {
        logger.debug(`⚡ [DbCache] Cache Evicted: ${key}`);
        return this.cache.del(key);
    }

    // [매장 관련 데이터베이스 캐시 원자적 소거]
    flushByStore(storeId) {
        const keys = this.cache.keys();
        const storeKeys = keys.filter(k => k.includes(`store:${storeId}`));
        if (storeKeys.length > 0) {
            this.cache.del(storeKeys);
            logger.info(`⚡ [DbCache] Flushed ${storeKeys.length} cached query buffers for Store ${storeId}`);
        }
    }

    // [전체 청소]
    flushAll() {
        logger.info(`⚡ [DbCache] Complete Flush All.`);
        return this.cache.flushAll();
    }
}

module.exports = new DbCache();

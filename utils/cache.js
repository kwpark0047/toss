const NodeCache = require('node-cache');

/**
 * 인메모리 캐시 유틸리티
 * 데이터베이스 부하를 줄이기 위해 자주 조회되는 데이터를 메모리에 저장합니다.
 */
class Cache {
    constructor(ttlSeconds = 300) {
        this.cache = new NodeCache({
            stdTTL: ttlSeconds, // 기본 유지 시간: 5분
            checkperiod: ttlSeconds * 0.2, // 만료 확인 주기
            useClones: false // 성능을 위해 클론 생략
        });
    }

    // [데이터 저장]
    set(key, value, ttl) {
        return this.cache.set(key, value, ttl);
    }

    // [데이터 조회]
    get(key) {
        return this.cache.get(key);
    }

    // [데이터 삭제]
    del(key) {
        return this.cache.del(key);
    }

    // [매장 관련 전체 캐시 삭제 (데이터 변경 시 호출)]
    flushByStore(storeId) {
        const keys = this.cache.keys();
        const storeKeys = keys.filter(k => k.includes(`store:${storeId}`));
        if (storeKeys.length > 0) {
            this.cache.del(storeKeys);
        }
    }

    // [전체 초기화]
    flushAll() {
        return this.cache.flushAll();
    }
}

// 싱글톤 인스턴스 수출
module.exports = new Cache();

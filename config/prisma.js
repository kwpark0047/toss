const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const logger = require('../utils/logger');

const DATABASE_URL = process.env.DATABASE_URL;
const REPLICA_URL = process.env.REPLICA_URL || DATABASE_URL; // 레플리카 키 누락 시 자동으로 주 데이터베이스로 가용 폴백

// 1. 주 데이터베이스 클라이언트 생성 (CUD - 쓰기 전용 세션 풀)
const prismaPrimary = new PrismaClient({
    datasources: {
        db: { url: DATABASE_URL }
    },
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// 2. 보조 복제 데이터베이스 클라이언트 생성 (R - 읽기 전용 복제 세션 풀)
const prismaReplica = new PrismaClient({
    datasources: {
        db: { url: REPLICA_URL }
    },
    log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// 쿼리 레이턴시 실시간 모니터링을 위한 전역 인메모리 링버퍼 (최대 50건 유지)
const queryLogBuffer = [];
const MAX_BUFFER_SIZE = 50;

// 실시간 데이터베이스 쿼리 레이턴시 진단 및 슬로우 쿼리 모니터링 엔진 등록 (SLA 지표 수집)
prismaPrimary.$on('query', (e) => {
    const duration = e.duration; // milliseconds
    const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 100; // 기본 100ms SLA 임계치

    // 전역 버퍼에 쿼리 실시간 수집 및 원형 누적 저장
    const logId = crypto.randomUUID().substring(0, 8);
    queryLogBuffer.unshift({
        id: logId,
        query: e.query,
        params: e.params,
        duration: e.duration,
        timestamp: new Date()
    });
    if (queryLogBuffer.length > MAX_BUFFER_SIZE) {
        queryLogBuffer.pop();
    }

    if (duration >= threshold) {
        try {
            const loggerInstance = require('../utils/logger');
            if (loggerInstance && typeof loggerInstance.warn === 'function') {
                loggerInstance.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query} | Params: ${e.params}`);
            } else {
                console.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query}`);
            }
        } catch (_) {
            // Jest 환경이 종료된(Torn Down) 비동기 백그라운드 쿼리 수신 시를 위한 안전 폴백
            console.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query}`);
        }
    }
});

// 3. 투명한 데이터베이스 읽기/쓰기 분기 라우팅 프록시 핸들러 설계
// 레포지토리의 소스코드 수정 오버헤드를 0%로 줄이기 위해 ES6 Proxy를 사용해 호출을 가로챕니다.
const readOnlyOperations = new Set([
    'findUnique', 'findMany', 'findFirst', 'count', 'aggregate', 'groupBy'
]);

const prismaProxy = new Proxy(prismaPrimary, {
    get(target, prop) {
        // 모니터링 APM 게터 전역 바인딩
        if (prop === 'getQueryLogs') {
            return () => queryLogBuffer;
        }

        // 트랜잭션 및 기본 원시 메서드들은 주 데이터베이스 컨텍스트 바인딩 보장
        if (
            prop === '$on' || 
            prop === '$connect' || 
            prop === '$disconnect' || 
            prop === '$transaction' || 
            prop === '$executeRaw' || 
            prop === '$queryRaw' || 
            prop === '$executeRawUnsafe' || 
            prop === '$queryRawUnsafe'
        ) {
            return target[prop].bind(target);
        }

        const delegate = target[prop];
        // 호출 프로퍼티가 Prisma 데이터 모델 델리게이트인 경우 (예: prisma.products)
        if (delegate && typeof delegate === 'object' && !prop.startsWith('$')) {
            return new Proxy(delegate, {
                get(modelTarget, modelProp) {
                    const originalMethod = modelTarget[modelProp];
                    if (typeof originalMethod === 'function') {
                        return function (...args) {
                            // 쿼리가 단순 조회 전용 SELECT 계열 메서드인 경우 레플리카 세션 풀로 쿼리 분기
                            if (readOnlyOperations.has(modelProp)) {
                                logger.debug(`[Prisma Router] Routing READ query [prisma.${prop}.${modelProp}] to Replica Pool`);
                                return prismaReplica[prop][modelProp](...args);
                            }
                            // 쓰기 및 데이터 변경성(CUD) 계열 메서드인 경우 마스터 세션 풀로 쿼리 분기
                            logger.debug(`[Prisma Router] Routing WRITE query [prisma.${prop}.${modelProp}] to Primary Pool`);
                            return originalMethod.apply(modelTarget, args);
                        };
                    }
                    return originalMethod;
                }
            });
        }

        return delegate;
    }
});

module.exports = prismaProxy;

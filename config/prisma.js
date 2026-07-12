const { PrismaClient } = require('@prisma/client');

// 쿼리 레이턴시 실시간 모니터링을 위한 전역 인메모리 링버퍼 (최대 50건 유지)
const queryLogBuffer = [];
const MAX_BUFFER_SIZE = 50;

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// 실시간 데이터베이스 쿼리 레이턴시 진단 및 슬로우 쿼리 모니터링 엔진 등록 (SLA 지표 수집)
prisma.$on('query', (e) => {
    const duration = e.duration; // milliseconds
    const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 100; // 기본 100ms SLA 임계치

    // 전역 버퍼에 쿼리 실시간 수집 및 원형 누적 저장
    const logId = Math.random().toString(36).substring(2, 10);
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
            const logger = require('../utils/logger');
            if (logger && typeof logger.warn === 'function') {
                logger.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query} | Params: ${e.params}`);
            } else {
                console.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query}`);
            }
        } catch (_) {
            // Jest 환경이 종료된(Torn Down) 비동기 백그라운드 쿼리 수신 시를 위한 안전 폴백
            console.warn(`🐌 [Prisma Slow Query] ${duration}ms | Query: ${e.query}`);
        }
    }
});

// 외부 모니터링 시스템을 위한 쿼리 로그 버퍼 조회용 게터 연동
prisma.getQueryLogs = () => queryLogBuffer;

module.exports = prisma;

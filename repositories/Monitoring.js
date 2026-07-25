const prisma = require('../config/prisma');

/**
 * 모니터링 모델 (Prisma 기반)
 * API 응답 시간 및 상태 코드를 기록하여 시스템 성능 통계를 제공합니다.
 */
const Metrics = {
    // [성능 데이터 기록]
    record: async (data) => {
        try {
            // metrics 모델이 없으면(미모의·미생성) 기록 생략 — 테스트 노이즈/런타임 크래시 방지
            if (!prisma.metrics) return;
            const { endpoint, method, response_time, status_code, store_id, user_id } = data;
            await prisma.metrics.create({
                data: {
                    endpoint,
                    method,
                    response_time: parseInt(response_time),
                    status_code: parseInt(status_code),
                    store_id: store_id ? parseInt(store_id) : null,
                    user_id: user_id ? parseInt(user_id) : null
                }
            });
        } catch (e) {
            console.error('[Monitoring.record Error]:', e);
        }
    },

    // [성능 통계 조회]
    getStats: async (startDate, endDate) => {
        const where = {};
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        const stats = await prisma.metrics.aggregate({
            _count: { _all: true },
            _avg: { response_time: true },
            where
        });

        return {
            total_requests: stats._count._all,
            avg_response_time: stats._avg.response_time || 0
        };
    }
};

module.exports = { Metrics };

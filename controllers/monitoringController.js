const catchAsync = require('../utils/catchAsync');
const Monitoring = require('../repositories/Monitoring');
const prisma = require('../config/prisma');

/**
 * 시스템 모니터링 통합 대시보드 컨트롤러
 * - 플랫폼 전체 메트릭 (매장/주문/사용자 집계)
 * - Performance 모니터링 (Metrics 테이블 기반)
 * - 서버 리소스 상태
 */
const monitoringController = {
    /**
     * [GET] 시스템 통합 메트릭
     * 인증 불필요 (헬스체크와 동일 수준)
     */
    getSystemStats: catchAsync(async (req, res) => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 1. 플랫폼 집계 (todayStart 기준)
        const [totalStores, activeStores, ordersToday, totalUsers] = await Promise.all([
            prisma.stores.count(),
            prisma.stores.count({ where: { is_active: true } }),
            prisma.orders.count({ where: { created_at: { gte: todayStart } } }),
            prisma.users.count(),
        ]);

        // 2. 최근 주문 매출 합계
        const revenueToday = await prisma.orders.aggregate({
            _sum: { total_amount: true },
            where: { created_at: { gte: todayStart }, status: { notIn: ['cancelled'] } },
        });

        // 3. Metrics repository 성능 통계 (최근 24h)
        const perf24h = await Monitoring.Metrics.getStats(
            new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            now.toISOString()
        );

        // 4. 서버 리소스
        const mem = process.memoryUsage();
        const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

        res.success({
            platform: {
                totalStores,
                activeStores,
                inactiveStores: totalStores - activeStores,
                totalUsers,
                ordersToday,
                revenueToday: revenueToday._sum.total_amount || 0,
            },
            performance: {
                totalRequests24h: perf24h.total_requests,
                avgResponseTimeMs: Math.round(perf24h.avg_response_time),
            },
            server: {
                uptimeSeconds: Math.floor(process.uptime()),
                heapUsedMB: memUsedMB,
                heapTotalMB: memTotalMB,
                heapUsagePct: memTotalMB > 0 ? Math.round((memUsedMB / memTotalMB) * 100) : 0,
                memoryRssMB: Math.round(mem.rss / 1024 / 1024),
            },
            ts: now.toISOString(),
        });
    }),

    /**
     * [GET] 에러 로그 요약 (슬라이딩 윈도우)
     * 인증 불필요
     */
    getErrorSummary: catchAsync(async (req, res) => {
        const hours = parseInt(req.query.hours) || 24;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const [errorNotifications, recentErrors] = await Promise.all([
            prisma.notifications.count({
                where: { type: 'SYSTEM_ERROR', created_at: { gte: since } },
            }),
            prisma.$queryRaw`
                SELECT COALESCE(COUNT(*), 0) AS cnt
                FROM "AuditLog"
                WHERE action = 'ERROR'
                  AND created_at >= ${since}
            `.then(r => Number(r[0]?.cnt || 0)),
        ]);

        res.success({
            periodHours: hours,
            errorNotifications,
            auditErrors: recentErrors,
            total: errorNotifications + recentErrors,
            ts: new Date().toISOString(),
        });
    }),
};

module.exports = monitoringController;

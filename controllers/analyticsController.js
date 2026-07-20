const Order = require('../repositories/Order');
const Store = require('../repositories/Store');
const catchAsync = require('../utils/catchAsync');

/**
 * WeMarket 매출 분석 및 통계 레포트 컨트롤러
 * 매장별 상세 판매 통계, 고급 시각 히트맵 인사이트, 미래 매출 예측 및 프랜차이즈 다점포 통합 정산을 관리합니다.
 */
const analyticsController = {
    /**
     * [GET] 매장별 상세 매출 분석 (기간별/시간별/요일별 정밀 분석)
     */
    getStoreSales: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }

        const stats = await Order.getDetailedStats(storeId, start_date, end_date);

        // 일일 요약 지표 추가 연산
        const totalSales = stats.daily.reduce((sum, d) => sum + d.amount, 0);
        const totalOrders = stats.daily.reduce((sum, d) => sum + d.count, 0);

        res.success({
            summary: {
                total_sales: totalSales,
                total_orders: totalOrders,
                avg_order_amount: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
                best_day: stats.daily.length > 0 ? [...stats.daily].sort((a, b) => b.amount - a.amount)[0] : null
            },
            data: stats.daily.map(d => ({
                label: d.date.slice(5), // MM-DD
                sales: d.amount,
                orders: d.count
            })),
            hourly: stats.hourly,
            dayOfWeek: stats.dayOfWeek
        });
    }),

    /**
     * [GET] 해당 매장의 인기 판매 메뉴 순위 조회
     */
    getPopularProducts: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { limit = 10 } = req.query;
        let { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            const today = new Date();
            const lastWeek = new Date();
            lastWeek.setDate(today.getDate() - 7);
            start_date = lastWeek.toISOString();
            end_date = today.toISOString();
        }

        const stats = await Order.getDetailedStats(storeId, start_date, end_date);

        res.success({
            products: stats.products.slice(0, parseInt(limit)).map((p, idx) => ({
                rank: idx + 1,
                product_id: p.product_name,
                product_name: p.product_name,
                total_quantity: p.total_quantity,
                total_sales: p.total_amount
            }))
        });
    }),

    /**
     * [GET] 기간 대비 매출 성장률 및 증감 분석
     */
    getComparisonStats: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { type = 'weekly' } = req.query;
        const stats = await Order.getComparisonStats(storeId, type);

        res.success(stats);
    }),

    /**
     * [GET] 고급 히트맵 인사이트 (요일×시간 가독성 히트맵, 카테고리 기여도, 재방문율)
     */
    getInsights: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }

        const insights = await Order.getAdvancedInsights(storeId, start_date, end_date);
        res.success(insights);
    }),

    /**
     * [GET] 직원 근태/성과 기여도 조회
     */
    getStaffPerformance: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }

        const stats = await Order.getStaffPerformance(storeId, start_date, end_date);
        res.success(stats);
    }),

    /**
     * [GET] KDS 주방 조리 속도 및 운영 효율 지표 분석
     */
    getKdsPerformance: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }

        const stats = await Order.getKdsPerformance(storeId, start_date, end_date);
        res.success(stats);
    }),

    /**
     * [GET] 인공지능 미래 매출 동향 예측 데이터 (7일~30일 범위)
     */
    getForecast: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const days = Math.min(parseInt(req.query.days) || 7, 30);
        const result = await Order.getForecast(storeId, days);

        res.success(result);
    }),

    /**
     * [GET] 프랜차이즈 다점포 통합 어드민 매출 요약 레포트 (SLA 통합 지표 수집)
     */
    getMultiStoreAnalytics: catchAsync(async (req, res) => {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
        }

        let stores;
        if (req.user.role === 'super_admin') {
            stores = await Store.findAll();
        } else {
            stores = await Store.findByUserId(req.user.id);
        }

        if (!stores || stores.length === 0) {
            return res.success({ 
                summary: { total_sales: 0, total_orders: 0, store_count: 0 }, 
                stores: [] 
            });
        }

        const storeIds = stores.map(s => s.id);
        const stats = await Order.getMultiStoreStats(storeIds, start_date, end_date);

        res.success(stats);
    }),

    /**
     * [GET] 데이터베이스 원자적 실시간 SQL 쿼리 프로파일링 로그 및 SLA 수집 조회 (슈퍼어드민 전용)
     */
    getDbProfileLogs: catchAsync(async (req, res) => {
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'unauthorized', message: '이 시스템의 데이터베이스 원장 프로파일러 권한이 없습니다.' });
        }

        const prismaInstance = require('../config/prisma');
        const logs = prismaInstance.getQueryLogs ? prismaInstance.getQueryLogs() : [];

        const total = logs.length;
        const avg = total > 0 ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / total) : 0;
        const max = total > 0 ? Math.max(...logs.map(l => l.duration)) : 0;
        const slowCount = logs.filter(l => l.duration >= 100).length;

        res.success({
            summary: {
                total_queries: total,
                avg_latency_ms: avg,
                max_latency_ms: max,
                slow_queries_count: slowCount,
                slow_query_ratio: total > 0 ? Math.round((slowCount / total) * 100) : 0
            },
            logs
        });
    }),

    getRealtimeStats: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

        const prisma = require('../config/prisma');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [todayOrders, todayRevenue, pendingOrders, preparingOrders, readyOrders] = await Promise.all([
            prisma.orders.count({ where: { store_id: storeId, created_at: { gte: today } } }),
            prisma.orders.aggregate({
                where: { store_id: storeId, created_at: { gte: today }, status: { notIn: ['cancelled', 'failed'] } },
                _sum: { total_amount: true },
            }),
            prisma.orders.count({ where: { store_id: storeId, status: 'pending' } }),
            prisma.orders.count({ where: { store_id: storeId, status: 'confirmed' } }),
            prisma.orders.count({ where: { store_id: storeId, status: 'ready' } }),
        ]);

        res.success({
            timestamp: new Date().toISOString(),
            today: {
                orders: todayOrders,
                revenue: todayRevenue._sum.total_amount || 0,
            },
            queue: {
                pending: pendingOrders,
                preparing: preparingOrders,
                ready: readyOrders,
            },
        });
    }),
};

module.exports = analyticsController;

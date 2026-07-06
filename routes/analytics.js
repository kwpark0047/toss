const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');

/**
 * @route   GET /api/analytics/store/:storeId/sales
 * @desc    매출 분석 데이터 조회 (기간별/시간별/요일별 포함)
 */
router.get('/store/:storeId/sales', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
    return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }

    const stats = await Order.getDetailedStats(storeId, start_date, end_date);

    // 요약 정보 추가 계산
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
}));

/**
 * @route   GET /api/analytics/store/:storeId/products
 * @desc    인기 메뉴 분석
 */
router.get('/store/:storeId/products', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
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
}));

/**
 * @route   GET /api/analytics/store/:storeId/comparison
 * @desc    기간 대비 성장률 분석 (실데이터 연동)
 */
router.get('/store/:storeId/comparison', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

    const { type = 'weekly' } = req.query;

    const stats = await Order.getComparisonStats(storeId, type);

    res.success(stats);
}));

/**
 * @route   GET /api/analytics/store/:storeId/insights
 * @desc    고급 인사이트 (F3): 요일×시간 히트맵, 재구매율, 카테고리별 매출
 */
router.get('/store/:storeId/insights', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }

    const insights = await Order.getAdvancedInsights(storeId, start_date, end_date);
    res.success(insights);
}));

/**
 * @route   GET /api/analytics/store/:storeId/staff
 * @desc    직원 성과 분석 데이터 조회
 */
router.get('/store/:storeId/staff', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
    return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }

    const stats = await Order.getStaffPerformance(storeId, start_date, end_date);

    res.success(stats);
}));

/**
 * @route   GET /api/analytics/store/:storeId/kds
 * @desc    KDS 효율 분석 (조리 시간 등) 조회
 */
router.get('/store/:storeId/kds', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return res.status(400).json({ error: '유효하지 않은 매장 ID입니다.' });

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
    return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }

    const stats = await Order.getKdsPerformance(storeId, start_date, end_date);
    res.success(stats);
}));

/**
 * @route   GET /api/analytics/multi-store
 * @desc    다점포 통합 매출 분석 조회
 */
router.get('/multi-store', authMiddleware, catchAsync(async (req, res) => {
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
    return res.success({ summary: { total_sales: 0, total_orders: 0, store_count: 0 }, stores: [] });
    }

    const storeIds = stores.map(s => s.id);
    const stats = await Order.getMultiStoreStats(storeIds, start_date, end_date);

    res.success(stats);
}));

module.exports = router;

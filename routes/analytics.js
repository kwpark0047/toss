const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// ── 매장별 매출 분석 (SLA 지표 수집) ──────────────────
router.get('/store/:storeId/sales', authMiddleware, checkStorePermission('stats:read'), analyticsController.getStoreSales);

// ── 인기 판매 상품 순위 조회 ──────────────────────────
router.get('/store/:storeId/products', authMiddleware, checkStorePermission('stats:read'), analyticsController.getPopularProducts);

// ── 기간 대비 성장률 및 지표 증감 분석 ──────────────────
router.get('/store/:storeId/comparison', authMiddleware, checkStorePermission('stats:read'), analyticsController.getComparisonStats);

// ── 요일×시간대 정밀 매출 히트맵 분석 ──────────────────
router.get('/store/:storeId/insights', authMiddleware, checkStorePermission('stats:read'), analyticsController.getInsights);

// ── 직원 근태 및 성과 기여도 분석 ──────────────────
router.get('/store/:storeId/staff', authMiddleware, checkStorePermission('stats:read'), analyticsController.getStaffPerformance);

// ── KDS 주방 조리 속도 및 주문 처리 효율 분석 ─────────
router.get('/store/:storeId/kds', authMiddleware, checkStorePermission('stats:read'), analyticsController.getKdsPerformance);

// ── 미래 매출 예측 리포트 조회 ────────────────────────
router.get('/store/:storeId/forecast', authMiddleware, checkStorePermission('stats:read'), analyticsController.getForecast);

// ── 브랜드 다점포 통합 어드민 매출 통계 조회 ──────────
router.get('/multi-store', authMiddleware, analyticsController.getMultiStoreAnalytics);

module.exports = router;

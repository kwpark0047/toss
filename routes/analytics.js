const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: 매장 통계 및 분석 API
 */

/**
 * @swagger
 * /api/analytics/store/{storeId}/sales:
 *   get:
 *     tags: [Analytics]
 *     summary: 매장별 매출 분석 (SLA 지표 수집)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 매출 분석 결과
 */
router.get('/store/:storeId/sales', authMiddleware, checkStorePermission('stats:read'), analyticsController.getStoreSales);

/**
 * @swagger
 * /api/analytics/store/{storeId}/products:
 *   get:
 *     tags: [Analytics]
 *     summary: 인기 판매 상품 순위 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 인기 상품 순위 목록
 */
router.get('/store/:storeId/products', authMiddleware, checkStorePermission('stats:read'), analyticsController.getPopularProducts);

/**
 * @swagger
 * /api/analytics/store/{storeId}/comparison:
 *   get:
 *     tags: [Analytics]
 *     summary: 기간 대비 성장률 및 지표 증감 분석
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 비교 분석 결과
 */
router.get('/store/:storeId/comparison', authMiddleware, checkStorePermission('stats:read'), analyticsController.getComparisonStats);

/**
 * @swagger
 * /api/analytics/store/{storeId}/insights:
 *   get:
 *     tags: [Analytics]
 *     summary: 요일×시간대 정밀 매출 히트맵 분석
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 히트맵 분석 결과
 */
router.get('/store/:storeId/insights', authMiddleware, checkStorePermission('stats:read'), analyticsController.getInsights);

/**
 * @swagger
 * /api/analytics/store/{storeId}/staff:
 *   get:
 *     tags: [Analytics]
 *     summary: 직원 근태 및 성과 기여도 분석
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 직원 성과 분석 결과
 */
router.get('/store/:storeId/staff', authMiddleware, checkStorePermission('stats:read'), analyticsController.getStaffPerformance);

/**
 * @swagger
 * /api/analytics/store/{storeId}/kds:
 *   get:
 *     tags: [Analytics]
 *     summary: KDS 주방 조리 속도 및 주문 처리 효율 분석
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: KDS 효율 분석 결과
 */
router.get('/store/:storeId/kds', authMiddleware, checkStorePermission('stats:read'), analyticsController.getKdsPerformance);

/**
 * @swagger
 * /api/analytics/store/{storeId}/forecast:
 *   get:
 *     tags: [Analytics]
 *     summary: 미래 매출 예측 리포트 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 매출 예측 결과
 */
router.get('/store/:storeId/forecast', authMiddleware, checkStorePermission('stats:read'), analyticsController.getForecast);

/**
 * @swagger
 * /api/analytics/multi-store:
 *   get:
 *     tags: [Analytics]
 *     summary: 브랜드 다점포 통합 어드민 매출 통계 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 다점포 통계 결과
 */
router.get('/multi-store', authMiddleware, analyticsController.getMultiStoreAnalytics);

/**
 * @swagger
 * /api/analytics/db-profile:
 *   get:
 *     tags: [Analytics]
 *     summary: 데이터베이스 쿼리 레이턴시 프로파일링
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: DB 프로파일 결과
 */
router.get('/db-profile', authMiddleware, analyticsController.getDbProfileLogs);

/**
 * @swagger
 * /api/analytics/store/{storeId}/realtime:
 *   get:
 *     tags: [Analytics]
 *     summary: 실시간 매출/주문 대시보드 데이터
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 실시간 통계 (오늘 주문수, 매출, 주방 대기열)
 */
router.get('/store/:storeId/realtime', authMiddleware, checkStorePermission('stats:read'), analyticsController.getRealtimeStats);

module.exports = router;

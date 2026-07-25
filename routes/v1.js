/**
 * @swagger
 * tags:
 *   name: OpenAPI v1
 *   description: WeMarket 외부 개발자용 Open API v1 (API Key 인증)
 */
const router = require('express').Router();
const v1Controller = require('../controllers/v1Controller');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');

router.use(apiKeyAuth); 

/**
 * @swagger
 * /api/v1/store:
 *   get:
 *     tags: [OpenAPI v1]
 *     summary: 매장 정보 조회
 *     security:
 *       - apiKeyHeader: []
 *     responses:
 *       200:
 *         description: 매장 정보
 */
router.get('/store', v1Controller.getStore);

/**
 * @swagger
 * /api/v1/menus:
 *   get:
 *     tags: [OpenAPI v1]
 *     summary: 메뉴 목록 조회
 *     security:
 *       - apiKeyHeader: []
 *     responses:
 *       200:
 *         description: 메뉴 목록
 */
router.get('/menus', v1Controller.getMenus);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     tags: [OpenAPI v1]
 *     summary: 주문 내역 검색
 *     security:
 *       - apiKeyHeader: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 주문 목록
 */
router.get('/orders', v1Controller.getOrders);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     tags: [OpenAPI v1]
 *     summary: 단일 주문 상세 조회
 *     security:
 *       - apiKeyHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 주문 상세
 */
router.get('/orders/:id', v1Controller.getOrderById);

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     tags: [OpenAPI v1]
 *     summary: 외부 신규 주문 생성 (write 스코프 필수)
 *     security:
 *       - apiKeyHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: 주문 생성 완료
 */
router.post('/orders', requireScope('write'), v1Controller.createOrder);

/**
 * @swagger
 * /api/v1/analytics/summary:
 *   get:
 *     tags: [OpenAPI v1]
 *     summary: 기간 매출 분석 통계 조회
 *     security:
 *       - apiKeyHeader: []
 *     parameters:
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
 *         description: 매출 분석 통계
 */
router.get('/analytics/summary', v1Controller.getAnalyticsSummary);

/**
 * @swagger
 * /api/v1/print/jobs/claim:
 *   post:
 *     tags: [OpenAPI v1]
 *     summary: 주방 프린트 잡 점유 (write 스코프 필수)
 *     security:
 *       - apiKeyHeader: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 점유된 작업 목록
 */
router.post('/print/jobs/claim', requireScope('write'), v1Controller.claimPrintJobs);

/**
 * @swagger
 * /api/v1/print/jobs/{id}/ack:
 *   post:
 *     tags: [OpenAPI v1]
 *     summary: 인쇄 피드백 수신 및 상태 갱신 (write 스코프 필수)
 *     security:
 *       - apiKeyHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 상태 갱신 완료
 */
router.post('/print/jobs/:id/ack', requireScope('write'), v1Controller.ackPrintJob);

module.exports = router;

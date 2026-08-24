const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, checkStorePermissionForObject } = require('../middleware/storeAuth');
const { validateBody, validateQuery, validateParams } = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { 
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  returnExchangeSchema,
  createPaymentSchema,
  confirmPaymentSchema,
  cancelPaymentSchema,
  orderSearchQuerySchema,
  orderIdParamSchema,
  orderNumberParamSchema,
} = require('../src/validation/schemas');
const {
  verifyOrderCapability,
  verifyCustomerHistoryCapability,
} = require('../utils/orderCapability');
const prisma = require('../config/prisma');
const { checkResourcePermission } = require('../middleware/storeAuth');

const checkOrderPermission = checkResourcePermission(
  prisma.orders,
  'id',
  'store_id',
  'orders:manage'
);

// 주문 capability 검증: 유효한 x-order-capability(고객 경로)가 있으면 우선 통과,
// super_admin/staff는 checkStorePermissionForObject로, 그 외 인증 사용자는
// 주문 소유권(checkResourcePermission)으로 접근을 허용한다.
const requireOrderCapability = (req, res, next) => {
  const orderId = parseInt(req.params.id || req.params.orderId);
  const capability = verifyOrderCapability(req.get('x-order-capability'));
  if (capability && capability.orderId === orderId) {
    req.orderCapability = capability;
    return next();
  }

  if (req.user?.role === 'super_admin' || req.user?.role === 'staff') {
    const middleware = checkStorePermissionForObject();
    return middleware(req, res, next);
  }

  if (req.user) {
    return checkOrderPermission(req, res, next);
  }

  return res.status(403).json({ error: '주문 결제 권한이 없거나 만료되었습니다.' });
};

const requireCustomerHistoryCapability = (req, res, next) => {
  const capability = verifyCustomerHistoryCapability(req.get('x-customer-history-capability'));
  if (!capability) {
    return res.status(403).json({ error: '고객 주문내역 조회 권한이 없거나 만료되었습니다.' });
  }
  req.customerHistoryCapability = capability;
  next();
};

/**
 * @swagger
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: 주문 생성
 *     description: |
 *       `Idempotency-Key` 헤더(UUID 권장)를 보내면 네트워크 타임아웃 후 재시도해도
 *       중복 주문이 생성되지 않는다. 동일 키의 이전 성공 응답이 그대로 재생되며
 *       응답에 `Idempotency-Replayed: true` 헤더가 포함된다.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema: { type: string }
 *         description: 중복 주문 방지용 고유 키 (권장)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: 주문 생성 완료
 *       409:
 *         description: 동일 Idempotency-Key 요청이 처리 중
 *       422:
 *         description: 동일 Idempotency-Key로 다른 본문 전송
 */
router.post(
  '/',
  idempotency({ namespace: 'orders:create' }),
  validateBody(createOrderSchema),
  orderController.createOrder
);

/**
 * @swagger
 * /api/orders/{orderId}/customer-token:
 *   post:
 *     tags: [Orders]
 *     summary: 고객용 웹 푸시 토큰 등록 (KDS 취소 알림용)
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: 토큰 등록 완료
 */
router.post(
  '/:orderId/customer-token',
  authMiddleware.optionalAuth,
  validateParams(orderIdParamSchema),
  requireOrderCapability,
  orderController.registerCustomerToken
);

/**
 * @swagger
 * /api/orders/customer/history:
 *   get:
 *     tags: [Orders]
 *     summary: 고객 본인의 주문 내역 조회
 *     parameters:
 *       - in: query
 *         name: phone
 *         schema: { type: string }
 *         description: 전화번호 기반 조회
 *       - in: query
 *         name: toss_key
 *         schema: { type: string }
 *         description: 토스 키 기반 조회
 *     responses:
 *       200:
 *         description: 주문 내역 목록
 */
router.get(
  '/customer/history',
  requireCustomerHistoryCapability,
  orderController.getCustomerHistory
);

/**
 * @swagger
 * /api/orders/store/{storeId}/detailed-stats:
 *   get:
 *     tags: [Orders]
 *     summary: 매장별 상세 통계 (그래프용)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 시간대별/카테고리별 상세 통계
 */
router.get(
  '/store/:storeId/detailed-stats',
  authMiddleware,
  validateParams({ params: orderSearchQuerySchema }), // storeId 파라미터용
  checkStorePermission('stats:read'),
  orderController.getDetailedStats
);

/**
 * @swagger
 * /api/orders/store/{storeId}/stats:
 *   get:
 *     tags: [Orders]
 *     summary: 매장별 주문 통계 (상단 카드용)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 오늘/이번 달 매출, 주문 수 등
 */
router.get(
  '/store/:storeId/stats',
  authMiddleware,
  validateParams({ params: orderSearchQuerySchema }),
  checkStorePermission('stats:read'),
  orderController.getStats
);

/**
 * @swagger
 * /api/orders/store/{storeId}:
 *   get:
 *     tags: [Orders]
 *     summary: 매장별 주문 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 주문 목록 (페이지네이션)
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  validateQuery(orderSearchQuerySchema),
  checkStorePermission('order:read'),
  orderController.getStoreOrders
);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: 주문 단일 상세 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 주문 상세 정보
 *       404:
 *         description: 주문을 찾을 수 없음
 */
router.get(
  '/:id',
  authMiddleware.optionalAuth,
  validateParams(orderIdParamSchema),
  requireOrderCapability,
  orderController.getOrderDetails
);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     tags: [Orders]
 *     summary: 주문 상태 업데이트
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrderStatusRequest'
 *     responses:
 *       200:
 *         description: 상태 변경 완료
 */
router.put('/:id/status', authMiddleware, validateParams(orderIdParamSchema), checkOrderPermission, validateBody(updateOrderStatusSchema), orderController.updateStatus);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: 주문 취소 (재고 복구 포함)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelOrderRequest'
 *     responses:
 *       200:
 *         description: 주문 취소 완료
 */
router.post('/:id/cancel', authMiddleware, validateParams(orderIdParamSchema), validateBody(cancelOrderSchema), orderController.cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/return-exchange:
 *   post:
 *     tags: [Orders]
 *     summary: 주문 반품/교환 신청
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReturnExchangeRequest'
 *     responses:
 *       200:
 *         description: 반품/교환 접수 완료
 */
router.post('/:id/return-exchange', authMiddleware, validateParams(orderIdParamSchema), checkOrderPermission, validateBody(returnExchangeSchema), orderController.returnExchange);

/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: 주문 삭제
 *     security:
 *       - bearerAuth: []
 *       - orderCapability: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 주문 삭제 완료
 */
router.delete('/:id', authMiddleware, validateParams(orderIdParamSchema), checkOrderPermission, orderController.deleteOrder);

/**
 * @swagger
 * /api/orders/store/{storeId}/eta:
 *   get:
 *     tags: [Orders]
 *     summary: 주문 예상 소요 시간(ETA) 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: items
 *         schema: { type: string }
 *         description: 주문 아이템 배열(JSON 문자열) [{"product_id":1,"quantity":2}]
 *     responses:
 *       200:
 *         description: 예상 소요 시간
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 etaMinutes: { type: integer }
 *                 activeOrdersAhead: { type: integer }
 *                 message: { type: string }
 */
router.get('/store/:storeId/eta', validateParams({ params: orderSearchQuerySchema }), orderController.getEta);

/**
 * @swagger
 * /api/orders/search:
 *   get:
 *     tags: [Orders]
 *     summary: 주문 검색 (관리자용)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string }
 *       - in: query
 *         name: paymentMethod
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 주문 검색 결과
 */
router.get('/search', authMiddleware, validateQuery(orderSearchQuerySchema), orderController.searchOrders);

module.exports = router;
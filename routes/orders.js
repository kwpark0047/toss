const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { checkStorePermission, checkStorePermissionForObject } = require('../middleware/storeAuth');
const { requireOrderCapabilityOrAuth } = require('../middleware/orderCapability');
const validate = require('../middleware/validate');
const idempotency = require('../middleware/idempotency');
const { order: schema } = require('../utils/validationSchemas');

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
 *             type: object
 *             required: [store_id, items, total_amount]
 *             properties:
 *               store_id: { type: integer }
 *               items: { type: array, items: { type: object, properties: { product_id: { type: integer }, quantity: { type: integer }, options: { type: object } } } }
 *               total_amount: { type: integer }
 *               table_number: { type: integer }
 *               coupon_code: { type: string }
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
  validate(schema.create),
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
  optionalAuth,
  requireOrderCapabilityOrAuth,
  checkStorePermissionForObject('orders'),
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
router.get('/customer/history', orderController.getCustomerHistory);

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
  optionalAuth,
  requireOrderCapabilityOrAuth,
  checkStorePermissionForObject('orders'),
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
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [confirmed, preparing, ready, completed, cancelled] }
 *     responses:
 *       200:
 *         description: 상태 변경 완료
 */
router.put(
  '/:id/status',
  authMiddleware,
  checkStorePermissionForObject('orders'),
  orderController.updateStatus
);

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
 *     responses:
 *       200:
 *         description: 주문 취소 완료
 */
router.post(
  '/:id/cancel',
  authMiddleware,
  checkStorePermissionForObject('orders'),
  orderController.cancelOrder
);

/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: 주문 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 주문 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  checkStorePermissionForObject('orders'),
  orderController.deleteOrder
);

module.exports = router;

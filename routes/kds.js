const express = require('express');
const router = express.Router();
const kdsController = require('../controllers/kdsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: KDS
 *   description: 키친 디스플레이 시스템 (주방 모니터) API
 */

/**
 * @swagger
 * /api/kds/stores/{storeId}/orders:
 *   get:
 *     tags: [KDS]
 *     summary: 활성 조리중/대기중 주문 목록 조회
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
 *         description: KDS 주문 목록 (preparing, ready 상태)
 */
router.get('/stores/:storeId/orders', authMiddleware, checkStorePermission('orders:read'), kdsController.getActiveOrders);

/**
 * @swagger
 * /api/kds/stores/{storeId}/orders/{orderId}/status:
 *   post:
 *     tags: [KDS]
 *     summary: 주문 조리 단계 상태 전이
 *     description: preparing → ready → completed 흐름으로 상태 변경
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [preparing, ready, completed]
 *     responses:
 *       200:
 *         description: 상태 전이 완료
 */
router.post('/stores/:storeId/orders/:orderId/status', authMiddleware, checkStorePermission('orders:update'), kdsController.updateOrderStatus);

module.exports = router;

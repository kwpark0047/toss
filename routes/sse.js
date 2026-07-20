const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sseController');

/**
 * @swagger
 * tags:
 *   name: SSE
 *   description: Server-Sent Events 스트리밍
 */

/**
 * @swagger
 * /api/sse/order/{orderId}:
 *   get:
 *     tags: [SSE]
 *     summary: 주문 상태 SSE 구독
 *     description: 주문의 실시간 상태 변경을 SSE로 수신합니다.
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 주문 ID
 *     responses:
 *       200:
 *         description: SSE 스트림 (text/event-stream)
 */
router.get('/order/:orderId', sseController.subscribeToOrder);

module.exports = router;

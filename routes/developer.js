/**
 * developer.js — 개발자 포털 (API 키 / 웹훅 엔드포인트 관리)
 *
 * 매장 소유주(JWT 인증 + 매장 권한)가 자신의 매장에 대한 API 키를 발급/폐기하고
 * 웹훅 엔드포인트를 등록/관리한다. 발급 시 평문 키는 1회만 반환.
 */
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const developerController = require('../controllers/developerController');

/**
 * @swagger
 * tags:
 *   name: Developer
 *   description: 개발자 포털 API (API 키, 웹훅 관리)
 */

/**
 * @swagger
 * /api/developer/stores/{storeId}/api-keys:
 *   get:
 *     tags: [Developer]
 *     summary: API 키 목록 조회
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
 *         description: API 키 목록 반환
 */
router.get('/stores/:storeId/api-keys', authMiddleware, developerController.listApiKeys);

/**
 * @swagger
 * /api/developer/stores/{storeId}/api-keys:
 *   post:
 *     tags: [Developer]
 *     summary: API 키 발급
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: API 키 발급 완료 (평문 키 1회만 반환)
 */
router.post('/stores/:storeId/api-keys', authMiddleware, developerController.createApiKey);

/**
 * @swagger
 * /api/developer/stores/{storeId}/api-keys/{keyId}:
 *   delete:
 *     tags: [Developer]
 *     summary: API 키 폐기
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: API 키 폐기 완료
 */
router.delete('/stores/:storeId/api-keys/:keyId', authMiddleware, developerController.revokeApiKey);

/**
 * @swagger
 * /api/developer/stores/{storeId}/webhooks:
 *   get:
 *     tags: [Developer]
 *     summary: 웹훅 엔드포인트 목록 조회
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
 *         description: 웹훅 목록 반환
 */
router.get('/stores/:storeId/webhooks', authMiddleware, developerController.listWebhooks);

/**
 * @swagger
 * /api/developer/stores/{storeId}/webhooks:
 *   post:
 *     tags: [Developer]
 *     summary: 웹훅 엔드포인트 생성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 웹훅 생성 완료
 */
router.post('/stores/:storeId/webhooks', authMiddleware, developerController.createWebhook);

/**
 * @swagger
 * /api/developer/stores/{storeId}/webhooks/{id}:
 *   delete:
 *     tags: [Developer]
 *     summary: 웹훅 엔드포인트 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 웹훅 삭제 완료
 */
router.delete('/stores/:storeId/webhooks/:id', authMiddleware, developerController.deleteWebhook);

/**
 * @swagger
 * /api/developer/stores/{storeId}/webhook-deliveries:
 *   get:
 *     tags: [Developer]
 *     summary: 최근 웹훅 전송 로그 조회
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
 *         description: 전송 로그 목록 반환
 */
router.get('/stores/:storeId/webhook-deliveries', authMiddleware, developerController.getDeliveryLogs);

module.exports = router;

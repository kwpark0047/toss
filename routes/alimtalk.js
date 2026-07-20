const express = require('express');
const router = express.Router();
const alimtalkController = require('../controllers/alimtalkController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: AlimTalk
 *   description: 알림톡 관리 API
 */

/**
 * @swagger
 * /api/alimtalk/stores/{storeId}/history:
 *   get:
 *     tags: [AlimTalk]
 *     summary: 실시간 알림톡 전송 이력 및 소모 비용 정산 통계 조회
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
 *         description: 알림톡 전송 이력 반환
 */
router.get('/stores/:storeId/history', authMiddleware, checkStorePermission('stats:read'), alimtalkController.getHistory);

module.exports = router;

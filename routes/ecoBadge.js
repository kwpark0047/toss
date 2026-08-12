const express = require('express');
const router = express.Router();
const ecoBadgeController = require('../controllers/ecoBadgeController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * /api/eco-badge/store/{storeId}:
 *   get:
 *     tags: [Eco Badge]
 *     summary: 매장 친환경 뱃지 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 친환경 뱃지 정보
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('stats:read'),
  ecoBadgeController.getEcoBadge
);

/**
 * @swagger
 * /api/eco-badge/refresh-all:
 *   post:
 *     tags: [Eco Badge]
 *     summary: 전체 매장 에코 뱃지 일괄 갱신 (슈퍼어드민)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 갱신 결과
 */
router.post('/refresh-all', authMiddleware, ecoBadgeController.refreshAllEcoBadges);

module.exports = router;

const express = require('express');
const router = express.Router();
const aiAutoOrderController = require('../controllers/aiAutoOrderController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

/**
 * @swagger
 * tags:
 *   name: AiAutoOrder
 *   description: AI 자동 발주 추천 (재고 부족 알림 + 수요 예측 결합)
 */

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/shortages:
 *   get:
 *     summary: 재고 부족 상품 조회 (자동 발주 후보 탐색)
 *     tags: [AiAutoOrder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: lookbackDays
 *         schema:
 *           type: integer
 *           default: 30
 *       - in: query
 *         name: leadTimeDays
 *         schema:
 *           type: integer
 *           default: 3
 *       - in: query
 *         name: safetyDays
 *         schema:
 *           type: integer
 *           default: 2
 *     responses:
 *       200:
 *         description: 재고 부족 상품 및 발주 후보 목록
 */
router.get(
  '/store/:storeId/shortages',
  authMiddleware,
  checkStorePermission('stats:read'),
  createAIRateLimiter('getShortages'),
  aiAutoOrderController.getShortages
);

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/recommend:
 *   post:
 *     summary: AI 자동 발주 추천 생성 (통계 + AI 조정 결합)
 *     tags: [AiAutoOrder]
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
 *               lookbackDays:
 *                 type: integer
 *                 default: 30
 *               leadTimeDays:
 *                 type: integer
 *                 default: 3
 *               safetyDays:
 *                 type: integer
 *                 default: 2
 *               horizonDays:
 *                 type: integer
 *                 default: 7
 *               useAI:
 *                 type: boolean
 *                 default: true
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: AI 발주 추천 생성 완료
 */
router.post(
  '/store/:storeId/recommend',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('generateRecommendation'),
  aiAutoOrderController.recommend
);

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/recommendations:
 *   get:
 *     summary: 발주 추천 목록 조회
 *     tags: [AiAutoOrder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, ordered]
 *           default: pending
 *     responses:
 *       200:
 *         description: 발주 추천 목록
 */
router.get(
  '/store/:storeId/recommendations',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiAutoOrderController.listRecommendations
);

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/recommendations/{id}:
 *   get:
 *     summary: 발주 추천 단건 상세 조회
 *     tags: [AiAutoOrder]
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
 *         description: 발주 추천 상세
 */
router.get(
  '/store/:storeId/recommendations/:id',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiAutoOrderController.getRecommendation
);

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/recommendations/{id}/decide:
 *   post:
 *     summary: 발주 추천 승인/거절/발주완료 결정
 *     tags: [AiAutoOrder]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, ordered]
 *     responses:
 *       200:
 *         description: 발주 추천 결정 완료
 */
router.post(
  '/store/:storeId/recommendations/:id/decide',
  authMiddleware,
  checkStorePermission('products:write'),
  aiAutoOrderController.decide
);

/**
 * @swagger
 * /api/ai-auto-order/store/{storeId}/stats:
 *   get:
 *     summary: 발주 추천 통계 조회
 *     tags: [AiAutoOrder]
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
 *         description: 발주 추천 통계 (대기/승인/거절/발주완료 건수, 총 발주 수량)
 */
router.get(
  '/store/:storeId/stats',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiAutoOrderController.getStats
);

module.exports = router;

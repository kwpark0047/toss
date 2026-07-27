const express = require('express');
const router = express.Router();
const menuOptimizationController = require('../controllers/menuOptimizationController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

/**
 * @swagger
 * tags:
 *   name: MenuOptimization
 *   description: 메뉴 최적화 AI 분석 API
 */

/**
 * @swagger
 * /api/menu-optimization/store/{storeId}/analysis:
 *   get:
 *     tags: [MenuOptimization]
 *     summary: 매장별 메뉴 수익성 분석 조회
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
 *         description: 메뉴 분석 데이터
 */
router.get('/store/:storeId/analysis',
  authMiddleware,
  checkStorePermission('stats:read'),
  createAIRateLimiter('getMenuAnalysis'),
  menuOptimizationController.getMenuAnalysis
);

/**
 * @swagger
 * /api/menu-optimization/store/{storeId}/proposal:
 *   get:
 *     tags: [MenuOptimization]
 *     summary: AI 기반 세트 메뉴 제안
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
 *         description: AI 세트 메뉴 제안
 */
router.get('/store/:storeId/proposal',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('proposeSetMenus'),
  menuOptimizationController.proposeSetMenus
);

module.exports = router;

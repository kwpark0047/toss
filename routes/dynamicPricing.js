const express = require('express');
const router = express.Router();
const dynamicPricingController = require('../controllers/dynamicPricingController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

/**
 * @swagger
 * tags:
 *   name: DynamicPricing
 *   description: AI 기반 동적 가격 책정 API
 */

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/rules:
 *   get:
 *     tags: [DynamicPricing]
 *     summary: 매장별 동적 가격 규칙 목록 조회
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
 *         description: 가격 규칙 목록
 */
router.get('/store/:storeId/rules',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getPricingRules
);

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/rules:
 *   post:
 *     tags: [DynamicPricing]
 *     summary: 동적 가격 규칙 생성
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
 *             required: [product_id, rule_name, rule_type, config]
 *             properties:
 *               product_id:
 *                 type: integer
 *               rule_name:
 *                 type: string
 *               rule_type:
 *                 type: string
 *                 enum: [TIME_BASED, DEMAND_BASED, COMPETITOR_BASED, INVENTORY_BASED, WEATHER_BASED]
 *               config:
 *                 type: object
 *               min_price:
 *                 type: integer
 *               max_price:
 *                 type: integer
 *               base_price:
 *                 type: integer
 *     responses:
 *       201:
 *         description: 가격 규칙 생성 완료
 */
router.post('/store/:storeId/rules',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('createPricingRule'),
  dynamicPricingController.createPricingRule
);

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/rules/{ruleId}:
 *   patch:
 *     tags: [DynamicPricing]
 *     summary: 동적 가격 규칙 활성화/비활성화
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
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
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 규칙 상태 변경 완료
 */
router.patch('/store/:storeId/rules/:ruleId',
  authMiddleware,
  checkStorePermission('products:write'),
  dynamicPricingController.updatePricingRule
);

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/rules/{ruleId}:
 *   delete:
 *     tags: [DynamicPricing]
 *     summary: 동적 가격 규칙 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 규칙 삭제 완료
 */
router.delete('/store/:storeId/rules/:ruleId',
  authMiddleware,
  checkStorePermission('products:write'),
  dynamicPricingController.deletePricingRule
);

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/price-logs:
 *   get:
 *     tags: [DynamicPricing]
 *     summary: 가격 변경 로그 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: 가격 변경 로그 목록
 */
router.get('/store/:storeId/price-logs',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getPriceLogs
);

/**
 * @swagger
 * /api/dynamic-pricing/store/{storeId}/activate:
 *   post:
 *     tags: [DynamicPricing]
 *     summary: 전체 활성 규칙 자동 적용 (스케줄触发)
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
 *         description: 가격 적용 완료
 */
router.post('/store/:storeId/activate',
  authMiddleware,
  checkStorePermission('products:write'),
  dynamicPricingController.activatePricingRules
);

module.exports = router;
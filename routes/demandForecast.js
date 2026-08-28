const express = require('express');
const router = express.Router();
const demandForecastController = require('../controllers/demandForecastController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

/**
 * @swagger
 * tags:
 *   name: DemandForecast
 *   description: AI 수요 예측 및 경쟁사 가격 관리
 */

/**
 * @swagger
 * /api/demand-forecast/store/{storeId}/forecasts:
 *   get:
 *     summary: 매장 수요 예측 조회
 *     tags: [DemandForecast]
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
 *         description: 수요 예측 데이터 반환 성공
 */
router.get(
  '/store/:storeId/forecasts',
  authMiddleware,
  checkStorePermission('stats:read'),
  createAIRateLimiter('getForecasts'),
  demandForecastController.getDemandForecasts
);

/**
 * @swagger
 * /api/demand-forecast/store/{storeId}/forecasts/generate:
 *   post:
 *     summary: AI 기반 수요 예측 생성
 *     tags: [DemandForecast]
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
 *         description: 수요 예측 생성 완료
 */
router.post(
  '/store/:storeId/forecasts/generate',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('generateForecasts'),
  demandForecastController.generateDemandForecasts
);

router.get(
  '/store/:storeId/forecasts/:forecastId',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getForecastById
);

router.get(
  '/store/:storeId/competitor-prices',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getCompetitorPrices
);

router.post(
  '/store/:storeId/competitor-prices',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('addCompetitorPrice'),
  demandForecastController.addCompetitorPrice
);

router.patch(
  '/store/:storeId/competitor-prices/:priceId',
  authMiddleware,
  checkStorePermission('products:write'),
  demandForecastController.updateCompetitorPrice
);

router.delete(
  '/store/:storeId/competitor-prices/:priceId',
  authMiddleware,
  checkStorePermission('products:write'),
  demandForecastController.deleteCompetitorPrice
);

router.get(
  '/store/:storeId/pricing-jobs',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getPricingJobs
);

router.post(
  '/store/:storeId/pricing-jobs/start',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('startPricingJob'),
  demandForecastController.startPricingOptimizationJob
);

router.get(
  '/store/:storeId/pricing-jobs/:jobId',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getPricingJobStatus
);

router.get(
  '/store/:storeId/pricing-jobs/:jobId',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getPricingJobStatus
);

/**
 * @swagger
 * /api/demand-forecast/store/{storeId}/forecasts/accuracy:
 *   get:
 *     summary: 수요 예측 정확도 평가
 *     tags: [DemandForecast]
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
 *         description: 예측 정확도 평가 결과
 */
router.get(
  '/store/:storeId/forecasts/accuracy',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.evaluateForecastAccuracy
);

/**
 * @swagger
 * /api/demand-forecast/store/{storeId}/products/{productId}/forecast:
 *   get:
 *     summary: 특정 상품 수요 예측 조회
 *     tags: [DemandForecast]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *     responses:
 *       200:
 *         description: 상품별 수요 예측 데이터
 */
router.get(
  '/store/:storeId/products/:productId/forecast',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getProductForecast
);

module.exports = router;

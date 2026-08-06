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
router.get('/store/:storeId/forecasts',
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
router.post('/store/:storeId/forecasts/generate',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('generateForecasts'),
  demandForecastController.generateDemandForecasts
);

router.get('/store/:storeId/forecasts/:forecastId',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getForecastById
);

router.get('/store/:storeId/competitor-prices',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getCompetitorPrices
);

router.post('/store/:storeId/competitor-prices',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('addCompetitorPrice'),
  demandForecastController.addCompetitorPrice
);

router.patch('/store/:storeId/competitor-prices/:priceId',
  authMiddleware,
  checkStorePermission('products:write'),
  demandForecastController.updateCompetitorPrice
);

router.delete('/store/:storeId/competitor-prices/:priceId',
  authMiddleware,
  checkStorePermission('products:write'),
  demandForecastController.deleteCompetitorPrice
);

router.get('/store/:storeId/pricing-jobs',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getPricingJobs
);

router.post('/store/:storeId/pricing-jobs/start',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('startPricingJob'),
  demandForecastController.startPricingOptimizationJob
);

router.get('/store/:storeId/pricing-jobs/:jobId',
  authMiddleware,
  checkStorePermission('stats:read'),
  demandForecastController.getPricingJobStatus
);

module.exports = router;
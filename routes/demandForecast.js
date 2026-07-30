const express = require('express');
const router = express.Router();
const demandForecastController = require('../controllers/demandForecastController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

router.get('/store/:storeId/forecasts',
  authMiddleware,
  checkStorePermission('stats:read'),
  createAIRateLimiter('getForecasts'),
  demandForecastController.getDemandForecasts
);

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
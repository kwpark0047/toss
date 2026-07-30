const express = require('express');
const router = express.Router();
const aiRecommendationsController = require('../controllers/aiRecommendationsController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { createAIRateLimiter } = require('../utils/aiRateLimiter');

router.get(
  '/store/:storeId/recommendations',
  authMiddleware,
  checkStorePermission('stats:read'),
  createAIRateLimiter('getRecommendations'),
  aiRecommendationsController.getRecommendations
);

router.post(
  '/store/:storeId/recommendations',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('createRecommendations'),
  aiRecommendationsController.createRecommendations
);

router.post(
  '/store/:storeId/recommendations/generate',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('generateRecommendations'),
  aiRecommendationsController.generateRecommendations
);

router.get(
  '/store/:storeId/recommendations/:id',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiRecommendationsController.getRecommendationById
);

router.patch(
  '/store/:storeId/recommendations/:id',
  authMiddleware,
  checkStorePermission('products:write'),
  aiRecommendationsController.updateRecommendation
);

router.delete(
  '/store/:storeId/recommendations/:id',
  authMiddleware,
  checkStorePermission('products:write'),
  aiRecommendationsController.deleteRecommendation
);

router.get(
  '/store/:storeId/segments',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiRecommendationsController.getCustomerSegments
);

router.post(
  '/store/:storeId/segments',
  authMiddleware,
  checkStorePermission('products:write'),
  createAIRateLimiter('createSegment'),
  aiRecommendationsController.createCustomerSegment
);

router.get(
  '/store/:storeId/personalizations',
  authMiddleware,
  checkStorePermission('customers:read'),
  aiRecommendationsController.getCustomerPersonalizations
);

router.get(
  '/store/:storeId/personalizations/:customerPhone',
  authMiddleware,
  checkStorePermission('customers:read'),
  aiRecommendationsController.getCustomerPersonalization
);

router.patch(
  '/store/:storeId/personalizations/:customerPhone',
  authMiddleware,
  checkStorePermission('customers:write'),
  aiRecommendationsController.updateCustomerPersonalization
);

router.get(
  '/store/:storeId/personalization-analytics',
  authMiddleware,
  checkStorePermission('stats:read'),
  aiRecommendationsController.getPersonalizationAnalytics
);

module.exports = router;

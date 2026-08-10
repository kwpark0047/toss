const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const recommendationTrackingController = require('../controllers/recommendationTrackingController');

/**
 * @swagger
 * tags:
 *   name: RecommendationTracking
 *   description: AI 추천 성과 추적 API
 */

// 공개 엔드포인트 (세션 기반 추적용)
router.post('/impression', catchAsync(recommendationTrackingController.recordImpression));
router.post('/click', catchAsync(recommendationTrackingController.recordClick));
router.post('/conversion', catchAsync(recommendationTrackingController.recordConversion));

// 관리자용 통계 조회 (인증 필요)
router.get(
  '/stats/daily/:storeId',
  authMiddleware,
  catchAsync(recommendationTrackingController.getDailyStats)
);
router.get(
  '/stats/summary/:storeId',
  authMiddleware,
  catchAsync(recommendationTrackingController.getSummaryStats)
);
router.get(
  '/stats/menu-performance/:storeId',
  authMiddleware,
  catchAsync(recommendationTrackingController.getMenuPerformance)
);
router.get(
  '/stats/time-period/:storeId',
  authMiddleware,
  catchAsync(recommendationTrackingController.getTimePeriodPerformance)
);
router.get(
  '/stats/funnel/:storeId/:sessionId',
  authMiddleware,
  catchAsync(recommendationTrackingController.getSessionFunnel)
);

module.exports = router;

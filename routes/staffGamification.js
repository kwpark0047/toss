const express = require('express');
const router = express.Router();
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const staffGamificationController = require('../controllers/staffGamificationController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * [직원 게임??API ?�우??
 * 직원 ?�과 분석 �?리더보드 관???�드?�인?��? 관리합?�다.
 */

// 1. 매장�??�과 리더보드 조회 (매장 ?�계 ?�기 권한 ?�요)
router.get('/store/:storeId/leaderboard', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getLeaderboard
);

// 2. 개별 직원 ?�과 ?�세 조회
router.get('/store/:storeId/performance/:staffId', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getStaffDetailPerformance
);

module.exports = router;


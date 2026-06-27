const express = require('express');
const router = express.Router();
const staffGamificationController = require('../controllers/staffGamificationController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * [직원 게임화 API 라우트]
 * 직원 성과 분석 및 리더보드 관련 엔드포인트를 관리합니다.
 */

// 1. 매장별 성과 리더보드 조회 (매장 통계 읽기 권한 필요)
router.get('/store/:storeId/leaderboard', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getLeaderboard
);

// 2. 개별 직원 성과 상세 조회
router.get('/store/:storeId/performance/:staffId', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getStaffDetailPerformance
);

module.exports = router;

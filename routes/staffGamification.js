const express = require('express');
const router = express.Router();
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const staffGamificationController = require('../controllers/staffGamificationController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: StaffGamification
 *   description: 직원 게임화/성과 분석 API
 */

/**
 * @swagger
 * /api/staff-gamification/store/{storeId}/leaderboard:
 *   get:
 *     tags: [StaffGamification]
 *     summary: 매장별 성과 리더보드 조회
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
 *         description: 리더보드 데이터
 */
router.get('/store/:storeId/leaderboard', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getLeaderboard
);

/**
 * @swagger
 * /api/staff-gamification/store/{storeId}/performance/{staffId}:
 *   get:
 *     tags: [StaffGamification]
 *     summary: 개별 직원 성과 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 직원 성과 상세
 */
router.get('/store/:storeId/performance/:staffId', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  staffGamificationController.getStaffDetailPerformance
);

module.exports = router;


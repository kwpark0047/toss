const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const planController = require('../controllers/planController');

/**
 * @swagger
 * tags:
 *   name: AdminPlans
 *   description: 관리자용 플랜 관리 API
 */

// 전체 플랜 목록 (관리자)
router.get('/', authMiddleware, checkPermission('plans:read'), planController.getAllPlans);

// 플랜 상세
router.get('/:id', authMiddleware, checkPermission('plans:read'), planController.getPlanById);

// 플랜 생성
router.post('/', authMiddleware, checkPermission('plans:write'), planController.createPlan);

// 플랜 수정
router.patch('/:id', authMiddleware, checkPermission('plans:write'), planController.updatePlan);

// 플랜 비활성화
router.patch(
  '/:id/deactivate',
  authMiddleware,
  checkPermission('plans:write'),
  planController.deactivatePlan
);

// 플랜 순서 변경
router.post(
  '/reorder',
  authMiddleware,
  checkPermission('plans:write'),
  planController.reorderPlans
);

// 구독 통계
router.get(
  '/stats/subscriptions',
  authMiddleware,
  checkPermission('plans:read'),
  planController.getSubscriptionStats
);

module.exports = router;

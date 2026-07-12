const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const planRequestsController = require('../controllers/planRequestsController');

// 플랜 업그레이드 신청 (store_admin, manager)
router.post('/', authMiddleware, planRequestsController.createRequest);

// 내 매장의 신청 내역
router.get('/store/:storeId', authMiddleware, planRequestsController.getStoreRequests);

// 전체 신청 목록 (super_admin만)
router.get('/', authMiddleware, planRequestsController.getAllRequests);

// 대기 중인 신청 수 (super_admin만)
router.get('/pending-count', authMiddleware, planRequestsController.getPendingCount);

// 신청 승인 (super_admin만)
router.post('/:id/approve', authMiddleware, planRequestsController.approveRequest);

// 신청 거절 (super_admin만)
router.post('/:id/reject', authMiddleware, planRequestsController.rejectRequest);

module.exports = router;

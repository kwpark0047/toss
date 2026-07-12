const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const staffRequestsController = require('../controllers/staffRequestsController');

// 역할 계정 신청 (store_admin)
router.post('/', authMiddleware, staffRequestsController.createRequest);

// 매장별 신청 내역 조회
router.get('/store/:storeId', authMiddleware, staffRequestsController.getStoreRequests);

// 전체 신청 목록 (super_admin만)
router.get('/', authMiddleware, staffRequestsController.getAllRequests);

// 대기 중인 신청 수 (super_admin용)
router.get('/pending-count', authMiddleware, staffRequestsController.getPendingCount);

// 신청 승인
router.post('/:id/approve', authMiddleware, staffRequestsController.approveRequest);

// 신청 거절
router.post('/:id/reject', authMiddleware, staffRequestsController.rejectRequest);

module.exports = router;

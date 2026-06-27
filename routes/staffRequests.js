const express = require('express');
const router = express.Router();
const StaffAccountRequest = require('../models/StaffAccountRequest');
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const catchAsync = require('../utils/catchAsync');

// 역할 계정 신청 (store_admin)
router.post('/', authMiddleware, catchAsync(async (req, res, next) => {
    const { store_id, role, count, reason } = req.body;

    if (!store_id || !role) {
        return next(new AppError('매장 ID와 신청 역할(manager/kitchen)은 필수입니다', 400));
    }
    if (!['manager', 'kitchen'].includes(role)) {
        return next(new AppError('매니저 또는 주방 역할만 신청 가능합니다', 400));
    }

    const store = await Store.findById(store_id);
    if (!store) {
        return next(new AppError('매장을 찾을 수 없습니다', 404));
    }
    if (store.user_id !== req.user.id && req.user.role !== 'super_admin') {
        return next(new AppError('권한이 없습니다', 403));
    }

    const request = await StaffAccountRequest.create({
        store_id,
        user_id: req.user.id,
        role,
        count: count || 1,
        reason
    });

    res.success(request, `${role === 'manager' ? '매니저' : '주방'} 계정 신청이 완료되었습니다`, 201);
}));

// 매장별 신청 내역 조회
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res, next) => {
    const store = await Store.findById(req.params.storeId);
    if (!store) {
        return next(new AppError('매장을 찾을 수 없습니다', 404));
    }
    if (store.user_id !== req.user.id && req.user.role !== 'super_admin') {
        return next(new AppError('권한이 없습니다', 403));
    }

    const requests = await StaffAccountRequest.findByStore(req.params.storeId);
    res.success(requests);
}));

// 전체 신청 목록 (super_admin만)
router.get('/', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 접근 가능합니다', 403));
    }
    const status = req.query.status || null;
    const requests = await StaffAccountRequest.findAll(status);
    res.success(requests);
}));

// 대기 중인 신청 수 (super_admin용)
router.get('/pending-count', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 접근 가능합니다', 403));
    }
    const count = await StaffAccountRequest.countPending();
    res.success({ count });
}));

// 신청 승인
router.post('/:id/approve', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 승인 가능합니다', 403));
    }
    const { admin_note } = req.body;
    const request = await StaffAccountRequest.approve(req.params.id, req.user.id, admin_note);
    res.success(request, '계정 신청이 승인되었습니다');
}));

// 신청 거절
router.post('/:id/reject', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 거절 가능합니다', 403));
    }
    const { admin_note } = req.body;
    const request = await StaffAccountRequest.reject(req.params.id, req.user.id, admin_note);
    res.success(request, '계정 신청이 거절되었습니다');
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const PlanRequest = require('../repositories/PlanRequest');
const Store = require('../repositories/Store');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const catchAsync = require('../utils/catchAsync');

// 플랜 업그레이드 신청 (store_admin, manager)
router.post('/', authMiddleware, catchAsync(async (req, res, next) => {
    const { store_id, requested_plan, reason } = req.body;

    if (!store_id || !requested_plan) {
        return next(new AppError('매장 ID와 신청 플랜은 필수입니다', 400));
    }
    if (!['pro', 'enterprise'].includes(requested_plan)) {
        return next(new AppError('유효하지 않은 플랜입니다', 400));
    }

    const store = await Store.findById(store_id);
    if (!store) {
        return next(new AppError('매장을 찾을 수 없습니다', 404));
    }
    if (store.user_id !== req.user.id && req.user.role !== 'super_admin') {
        return next(new AppError('권한이 없습니다', 403));
    }

    const planOrder = { free: 0, pro: 1, enterprise: 2 };
    if (planOrder[store.plan || 'free'] >= planOrder[requested_plan]) {
        return next(new AppError('현재 플랜과 같거나 하위 플랜으로는 신청할 수 없습니다', 400));
    }

    const request = await PlanRequest.create({
        store_id,
        user_id: req.user.id,
        current_plan: store.plan || 'free',
        requested_plan,
        reason
    });

    res.success(request, '플랜 업그레이드 신청이 완료되었습니다', 201);
}));

// 내 매장의 신청 내역
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res, next) => {
    const store = await Store.findById(req.params.storeId);
    if (!store) {
        return next(new AppError('매장을 찾을 수 없습니다', 404));
    }
    if (store.user_id !== req.user.id && req.user.role !== 'super_admin') {
        return next(new AppError('권한이 없습니다', 403));
    }

    const requests = await PlanRequest.findByStore(req.params.storeId);
    res.success(requests);
}));

// 전체 신청 목록 (super_admin만)
router.get('/', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 조회할 수 있습니다', 403));
    }
    const status = req.query.status || null;
    const requests = await PlanRequest.findAll(status);
    res.success(requests);
}));

// 대기 중인 신청 수 (super_admin만)
router.get('/pending-count', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 조회할 수 있습니다', 403));
    }
    const count = await PlanRequest.countPending();
    res.success({ count });
}));

// 신청 승인 (super_admin만)
router.post('/:id/approve', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 승인할 수 있습니다', 403));
    }
    const { admin_note } = req.body;
    const request = await PlanRequest.approve(req.params.id, req.user.id, admin_note);
    res.success(request, '플랜 업그레이드가 승인되었습니다');
}));

// 신청 거절 (super_admin만)
router.post('/:id/reject', authMiddleware, catchAsync(async (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return next(new AppError('전체관리자만 거절할 수 있습니다', 403));
    }
    const { admin_note } = req.body;
    const request = await PlanRequest.reject(req.params.id, req.user.id, admin_note);
    res.success(request, '플랜 업그레이드 신청이 거절되었습니다');
}));

module.exports = router;

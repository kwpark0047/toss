const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const PlanRequestsService = require('../services/PlanRequestsService');

const planRequestsService = new PlanRequestsService();

const planRequestsController = {
    // 플랜 업그레이드 신청
    createRequest: catchAsync(async (req, res, next) => {
        const request = await planRequestsService.createRequest(req.user.id, req.body);
        res.success(request, '플랜 업그레이드 신청이 완료되었습니다', 201);
    }),

    // 내 매장의 신청 내역
    getStoreRequests: catchAsync(async (req, res, next) => {
        const requests = await planRequestsService.getStoreRequests(
            req.params.storeId, req.user.id, req.user.role
        );
        res.success(requests);
    }),

    // 전체 신청 목록 (super_admin만)
    getAllRequests: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 조회할 수 있습니다', 403));
        }
        const requests = await planRequestsService.getAllRequests(req.query.status || null);
        res.success(requests);
    }),

    // 대기 중인 신청 수 (super_admin만)
    getPendingCount: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 조회할 수 있습니다', 403));
        }
        const count = await planRequestsService.getPendingCount();
        res.success({ count });
    }),

    // 신청 승인 (super_admin만)
    approveRequest: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 승인할 수 있습니다', 403));
        }
        const request = await planRequestsService.approveRequest(
            req.params.id, req.user.id, req.body.admin_note
        );
        res.success(request, '플랜 업그레이드가 승인되었습니다');
    }),

    // 신청 거절 (super_admin만)
    rejectRequest: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 거절할 수 있습니다', 403));
        }
        const request = await planRequestsService.rejectRequest(
            req.params.id, req.user.id, req.body.admin_note
        );
        res.success(request, '플랜 업그레이드 신청이 거절되었습니다');
    })
};

module.exports = planRequestsController;

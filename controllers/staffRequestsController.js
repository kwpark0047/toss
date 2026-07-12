const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const StaffRequestsService = require('../services/StaffRequestsService');

const staffRequestsService = new StaffRequestsService();

const staffRequestsController = {
    // 역할 계정 신청
    createRequest: catchAsync(async (req, res, next) => {
        const request = await staffRequestsService.createRequest(req.user.id, req.body);
        const roleLabel = req.body.role === 'manager' ? '매니저' : '주방';
        res.success(request, `${roleLabel} 계정 신청이 완료되었습니다`, 201);
    }),

    // 매장별 신청 내역 조회
    getStoreRequests: catchAsync(async (req, res, next) => {
        const requests = await staffRequestsService.getStoreRequests(
            req.params.storeId, req.user.id, req.user.role
        );
        res.success(requests);
    }),

    // 전체 신청 목록 (super_admin만)
    getAllRequests: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 접근 가능합니다', 403));
        }
        const requests = await staffRequestsService.getAllRequests(req.query.status || null);
        res.success(requests);
    }),

    // 대기 중인 신청 수 (super_admin용)
    getPendingCount: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 접근 가능합니다', 403));
        }
        const count = await staffRequestsService.getPendingCount();
        res.success({ count });
    }),

    // 신청 승인
    approveRequest: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 승인 가능합니다', 403));
        }
        const request = await staffRequestsService.approveRequest(
            req.params.id, req.user.id, req.body.admin_note
        );
        res.success(request, '계정 신청이 승인되었습니다');
    }),

    // 신청 거절
    rejectRequest: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('전체관리자만 거절 가능합니다', 403));
        }
        const request = await staffRequestsService.rejectRequest(
            req.params.id, req.user.id, req.body.admin_note
        );
        res.success(request, '계정 신청이 거절되었습니다');
    })
};

module.exports = staffRequestsController;

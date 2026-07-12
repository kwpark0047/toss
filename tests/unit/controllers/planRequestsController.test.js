// planRequestsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    createRequest: jest.fn(),
    getStoreRequests: jest.fn(),
    getAllRequests: jest.fn(),
    getPendingCount: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
};
jest.mock('../../../services/PlanRequestsService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const planRequestsController = require('../../../controllers/planRequestsController');

describe('planRequestsController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10, role: 'owner' } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
        next = jest.fn();
    });

    describe('createRequest', () => {
        test('플랜 업그레이드 신청을 생성한다', async () => {
            req.body = { store_id: 1, requested_plan: 'pro' };
            mockService.createRequest.mockResolvedValue({ id: 1, status: 'pending' });
            await planRequestsController.createRequest(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('getStoreRequests', () => {
        test('매장별 신청 내역을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreRequests.mockResolvedValue([{ id: 1 }]);
            await planRequestsController.getStoreRequests(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('getAllRequests', () => {
        test('super_admin이 전체 목록을 조회한다', async () => {
            req.user.role = 'super_admin';
            mockService.getAllRequests.mockResolvedValue([{ id: 1 }]);
            await planRequestsController.getAllRequests(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'owner';
            await planRequestsController.getAllRequests(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('getPendingCount', () => {
        test('super_admin이 대기 수를 조회한다', async () => {
            req.user.role = 'super_admin';
            mockService.getPendingCount.mockResolvedValue(5);
            await planRequestsController.getPendingCount(req, res, next);
            expect(res.success).toHaveBeenCalledWith({ count: 5 });
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'owner';
            await planRequestsController.getPendingCount(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('approveRequest', () => {
        test('super_admin이 신청을 승인한다', async () => {
            req.user.role = 'super_admin';
            req.params.id = '1';
            req.body = { admin_note: '승인' };
            mockService.approveRequest.mockResolvedValue({ id: 1, status: 'approved' });
            await planRequestsController.approveRequest(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'admin';
            req.params.id = '1';
            await planRequestsController.approveRequest(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('rejectRequest', () => {
        test('super_admin이 신청을 거절한다', async () => {
            req.user.role = 'super_admin';
            req.params.id = '1';
            req.body = { admin_note: '거절' };
            mockService.rejectRequest.mockResolvedValue({ id: 1, status: 'rejected' });
            await planRequestsController.rejectRequest(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'admin';
            req.params.id = '1';
            await planRequestsController.rejectRequest(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });
});

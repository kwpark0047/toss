// staffRequestsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    createRequest: jest.fn(),
    getStoreRequests: jest.fn(),
    getAllRequests: jest.fn(),
    getPendingCount: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
};
jest.mock('../../../services/StaffRequestsService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const staffRequestsController = require('../../../controllers/staffRequestsController');

describe('staffRequestsController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10, role: 'owner' } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn(), created: jest.fn() };
        next = jest.fn();
    });

    describe('createRequest', () => {
        test('매니저 역할 계정 신청을 생성한다', async () => {
            req.body = { store_id: 1, role: 'manager' };
            mockService.createRequest.mockResolvedValue({ id: 1, role: 'manager' });
            await staffRequestsController.createRequest(req, res, next);
            expect(res.created).toHaveBeenCalled();
        });

        test('주방 역할 계정 신청을 생성한다', async () => {
            req.body = { store_id: 1, role: 'kitchen', count: 2 };
            mockService.createRequest.mockResolvedValue({ id: 1, role: 'kitchen' });
            await staffRequestsController.createRequest(req, res, next);
            expect(res.created).toHaveBeenCalled();
        });
    });

    describe('getStoreRequests', () => {
        test('매장별 신청 내역을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreRequests.mockResolvedValue([{ id: 1 }]);
            await staffRequestsController.getStoreRequests(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('getAllRequests', () => {
        test('super_admin이 전체 목록을 조회한다', async () => {
            req.user.role = 'super_admin';
            mockService.getAllRequests.mockResolvedValue([{ id: 1 }]);
            await staffRequestsController.getAllRequests(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'owner';
            await staffRequestsController.getAllRequests(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('getPendingCount', () => {
        test('super_admin이 대기 수를 조회한다', async () => {
            req.user.role = 'super_admin';
            mockService.getPendingCount.mockResolvedValue(3);
            await staffRequestsController.getPendingCount(req, res, next);
            expect(res.success).toHaveBeenCalledWith({ count: 3 });
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'admin';
            await staffRequestsController.getPendingCount(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('approveRequest', () => {
        test('super_admin이 신청을 승인한다', async () => {
            req.user.role = 'super_admin';
            req.params.id = '1';
            req.body = { admin_note: '승인' };
            mockService.approveRequest.mockResolvedValue({ id: 1, status: 'approved' });
            await staffRequestsController.approveRequest(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'admin';
            req.params.id = '1';
            await staffRequestsController.approveRequest(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    describe('rejectRequest', () => {
        test('super_admin이 신청을 거절한다', async () => {
            req.user.role = 'super_admin';
            req.params.id = '1';
            req.body = { admin_note: '거절' };
            mockService.rejectRequest.mockResolvedValue({ id: 1, status: 'rejected' });
            await staffRequestsController.rejectRequest(req, res, next);
            expect(res.success).toHaveBeenCalled();
        });

        test('super_admin이 아니면 403', async () => {
            req.user.role = 'admin';
            req.params.id = '1';
            await staffRequestsController.rejectRequest(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });
});

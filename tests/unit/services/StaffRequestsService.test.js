// StaffRequestsService 단위 테스트
jest.mock('../../../repositories/StaffAccountRequest', () => ({
    create: jest.fn(),
    findByStore: jest.fn(),
    findAll: jest.fn(),
    countPending: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
}));
jest.mock('../../../repositories/Store', () => ({
    findById: jest.fn(),
}));

const StaffRequestsService = require('../../../services/StaffRequestsService');
const StaffAccountRequest = require('../../../repositories/StaffAccountRequest');
const Store = require('../../../repositories/Store');

describe('StaffRequestsService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new StaffRequestsService();
    });

    describe('createRequest', () => {
        test('매니저 역할 계정 신청을 생성한다', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            StaffAccountRequest.create.mockResolvedValue({ id: 1, role: 'manager', status: 'pending' });

            const result = await svc.createRequest(10, { store_id: 1, role: 'manager' });

            expect(result.role).toBe('manager');
            expect(result.status).toBe('pending');
            expect(StaffAccountRequest.create).toHaveBeenCalledWith(expect.objectContaining({
                store_id: 1,
                user_id: 10,
                role: 'manager',
                count: 1,
            }));
        });

        test('주방 역할 계정 신청을 생성한다', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            StaffAccountRequest.create.mockResolvedValue({ id: 2, role: 'kitchen', status: 'pending' });

            const _result = await svc.createRequest(10, { store_id: 1, role: 'kitchen', count: 3 });

            expect(StaffAccountRequest.create).toHaveBeenCalledWith(expect.objectContaining({
                role: 'kitchen',
                count: 3,
            }));
        });

        test('store_id 없으면 400 에러', async () => {
            await expect(svc.createRequest(10, { role: 'manager' })).rejects.toThrow('매장 ID와 신청 역할');
        });

        test('유효하지 않은 역할이면 400 에러', async () => {
            await expect(svc.createRequest(10, { store_id: 1, role: 'admin' })).rejects.toThrow('매니저 또는 주방 역할만 신청 가능합니다');
        });

        test('매장이 없으면 404 에러', async () => {
            Store.findById.mockResolvedValue(null);
            await expect(svc.createRequest(10, { store_id: 999, role: 'manager' })).rejects.toThrow('매장을 찾을 수 없습니다');
        });

        test('매장 소유자가 아니면 403 에러', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 20 });
            await expect(svc.createRequest(10, { store_id: 1, role: 'manager' })).rejects.toThrow('권한이 없습니다');
        });
    });

    describe('getStoreRequests', () => {
        test('매장별 신청 내역을 조회한다', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            StaffAccountRequest.findByStore.mockResolvedValue([{ id: 1 }]);

            const result = await svc.getStoreRequests(1, 10, 'owner');
            expect(result).toHaveLength(1);
        });

        test('매장 소유자가 아니고 super_admin도 아니면 403', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            await expect(svc.getStoreRequests(1, 20, 'owner')).rejects.toThrow('권한이 없습니다');
        });

        test('super_admin은 다른 매장도 조회 가능', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            StaffAccountRequest.findByStore.mockResolvedValue([]);
            const result = await svc.getStoreRequests(1, 99, 'super_admin');
            expect(result).toEqual([]);
        });
    });

    describe('getAllRequests', () => {
        test('전체 신청 목록을 조회한다', async () => {
            StaffAccountRequest.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const result = await svc.getAllRequests('pending');
            expect(result).toHaveLength(2);
        });
    });

    describe('getPendingCount', () => {
        test('대기 중인 신청 수를 반환한다', async () => {
            StaffAccountRequest.countPending.mockResolvedValue(3);
            const result = await svc.getPendingCount();
            expect(result).toBe(3);
        });
    });

    describe('approveRequest', () => {
        test('신청을 승인한다', async () => {
            StaffAccountRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
            const result = await svc.approveRequest(1, 99, '승인');
            expect(result.status).toBe('approved');
        });
    });

    describe('rejectRequest', () => {
        test('신청을 거절한다', async () => {
            StaffAccountRequest.reject.mockResolvedValue({ id: 1, status: 'rejected' });
            const result = await svc.rejectRequest(1, 99, '거절');
            expect(result.status).toBe('rejected');
        });
    });
});

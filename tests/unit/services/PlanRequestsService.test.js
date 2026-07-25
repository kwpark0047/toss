// PlanRequestsService 단위 테스트
jest.mock('../../../repositories/PlanRequest', () => ({
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

const PlanRequestsService = require('../../../services/PlanRequestsService');
const PlanRequest = require('../../../repositories/PlanRequest');
const Store = require('../../../repositories/Store');

describe('PlanRequestsService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new PlanRequestsService();
    });

    describe('createRequest', () => {
        test('플랜 업그레이드 신청을 생성한다', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10, plan: 'free' });
            PlanRequest.create.mockResolvedValue({ id: 1, status: 'pending', requested_plan: 'pro' });

            const result = await svc.createRequest(10, { store_id: 1, requested_plan: 'pro', reason: '필요' });

            expect(result.status).toBe('pending');
            expect(PlanRequest.create).toHaveBeenCalledWith(expect.objectContaining({
                store_id: 1,
                user_id: 10,
                current_plan: 'free',
                requested_plan: 'pro',
            }));
        });

        test('store_id 없으면 400 에러', async () => {
            await expect(svc.createRequest(10, { requested_plan: 'pro' })).rejects.toThrow('매장 ID와 신청 플랜은 필수입니다');
        });

        test('유효하지 않은 플랜이면 400 에러', async () => {
            await expect(svc.createRequest(10, { store_id: 1, requested_plan: 'basic' })).rejects.toThrow('유효하지 않은 플랜입니다');
        });

        test('매장이 없으면 404 에러', async () => {
            Store.findById.mockResolvedValue(null);
            await expect(svc.createRequest(10, { store_id: 999, requested_plan: 'pro' })).rejects.toThrow('매장을 찾을 수 없습니다');
        });

        test('매장 소유자가 아니면 403 에러', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 20, plan: 'free' });
            await expect(svc.createRequest(10, { store_id: 1, requested_plan: 'pro' })).rejects.toThrow('권한이 없습니다');
        });

        test('현재 플랜과 같거나 하위 플랜이면 400 에러', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10, plan: 'enterprise' });
            await expect(svc.createRequest(10, { store_id: 1, requested_plan: 'pro' })).rejects.toThrow('현재 플랜과 같거나 하위 플랜으로는 신청할 수 없습니다');
        });
    });

    describe('getStoreRequests', () => {
        test('매장별 신청 내역을 조회한다', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            PlanRequest.findByStore.mockResolvedValue([{ id: 1 }]);

            const result = await svc.getStoreRequests(1, 10, 'owner');

            expect(result).toHaveLength(1);
        });

        test('매장 소유자가 아니고 super_admin도 아니면 403', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            await expect(svc.getStoreRequests(1, 20, 'owner')).rejects.toThrow('권한이 없습니다');
        });

        test('super_admin은 다른 매장도 조회 가능', async () => {
            Store.findById.mockResolvedValue({ id: 1, user_id: 10 });
            PlanRequest.findByStore.mockResolvedValue([]);
            const result = await svc.getStoreRequests(1, 99, 'super_admin');
            expect(result).toEqual([]);
        });
    });

    describe('getAllRequests', () => {
        test('전체 신청 목록을 조회한다', async () => {
            PlanRequest.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const result = await svc.getAllRequests('pending');
            expect(result).toHaveLength(2);
            expect(PlanRequest.findAll).toHaveBeenCalledWith('pending');
        });
    });

    describe('getPendingCount', () => {
        test('대기 중인 신청 수를 반환한다', async () => {
            PlanRequest.countPending.mockResolvedValue(5);
            const result = await svc.getPendingCount();
            expect(result).toBe(5);
        });
    });

    describe('approveRequest', () => {
        test('신청을 승인한다', async () => {
            PlanRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
            const result = await svc.approveRequest(1, 99, '승인함');
            expect(result.status).toBe('approved');
        });
    });

    describe('rejectRequest', () => {
        test('신청을 거절한다', async () => {
            PlanRequest.reject.mockResolvedValue({ id: 1, status: 'rejected' });
            const result = await svc.rejectRequest(1, 99, '거절함');
            expect(result.status).toBe('rejected');
        });
    });
});

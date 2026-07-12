// waitingController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    getStoreStatus: jest.fn(),
    getStoreWaitingList: jest.fn(),
    register: jest.fn(),
    updateStatus: jest.fn(),
    getMyWaiting: jest.fn(),
};
jest.mock('../../../services/WaitingService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const waitingController = require('../../../controllers/waitingController');

describe('waitingController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10 } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
        next = jest.fn();
    });

    describe('getStoreStatus', () => {
        test('매장 대기 현황을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreStatus.mockResolvedValue(5);
            await waitingController.getStoreStatus(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, waiting_teams: 5 });
        });
    });

    describe('getStoreWaitingList', () => {
        test('매장 대기 리스트를 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreWaitingList.mockResolvedValue([{ id: 1 }]);
            await waitingController.getStoreWaitingList(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
        });
    });

    describe('register', () => {
        test('대기를 등록한다', async () => {
            req.body = { store_id: 1, name: '김철수', phone: '01012345678', party_size: 2 };
            mockService.register.mockResolvedValue({ id: 1, position: 3 });
            await waitingController.register(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('updateStatus', () => {
        test('대기 상태를 변경한다', async () => {
            req.params.id = '1';
            req.body = { status: 'called' };
            mockService.updateStatus.mockResolvedValue({ id: 1, status: 'called' });
            await waitingController.updateStatus(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('getMyWaiting', () => {
        test('내 대기 상태를 조회한다', async () => {
            req.params.phone = '01012345678';
            mockService.getMyWaiting.mockResolvedValue({ position: 2, ahead_count: 1 });
            await waitingController.getMyWaiting(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });
});

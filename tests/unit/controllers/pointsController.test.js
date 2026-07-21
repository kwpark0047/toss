// pointsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    getBalance: jest.fn(),
    getHistory: jest.fn(),
    walletLookup: jest.fn(),
    calculateEarnPoints: jest.fn(),
    calculateUsablePoints: jest.fn(),
    getStoreSettings: jest.fn(),
    updateStoreSettings: jest.fn(),
    adminEarn: jest.fn(),
    adminDeduct: jest.fn(),
};
jest.mock('../../../services/PointsService', () => mockService);

const pointsController = require('../../../controllers/pointsController');

describe('pointsController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10, role: 'owner' } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
        next = jest.fn();
    });

    describe('getBalance', () => {
        test('잔액을 조회하여 반환한다', async () => {
            mockService.getBalance.mockResolvedValue({ balance: 5000 });
            await pointsController.getBalance(req, res);
            expect(mockService.getBalance).toHaveBeenCalledWith({ user_id: 10 });
            expect(res.json).toHaveBeenCalledWith({ balance: 5000 });
        });
    });

    describe('getHistory', () => {
        test('포인트 내역을 조회한다', async () => {
            req.query = { store_id: '1', type: 'earn', limit: '10', offset: '0' };
            mockService.getHistory.mockResolvedValue({ items: [], total: 0 });
            await pointsController.getHistory(req, res);
            expect(mockService.getHistory).toHaveBeenCalledWith(
                { user_id: 10 },
                { store_id: 1, type: 'earn', limit: 10, offset: 0 }
            );
        });
    });

    describe('walletLookup', () => {
        test('전화번호로 월렛을 조회한다', async () => {
            req.query = { phone: '01012345678', store_id: '1' };
            mockService.walletLookup.mockResolvedValue({ points: 1000 });
            await pointsController.walletLookup(req, res);
            expect(mockService.walletLookup).toHaveBeenCalledWith({ phone: '01012345678' }, 1);
        });

        test('식별 정보 없으면 400 에러', async () => {
            req.query = {};
            await expect(pointsController.walletLookup(req, res, next)).rejects.toThrow('휴대폰 번호 또는 식별 정보가 필요합니다.');
        });
    });

    describe('calculateEarnPoints', () => {
        test('적립 포인트를 계산한다', async () => {
            req.query = { amount: '10000', store_id: '1' };
            mockService.calculateEarnPoints.mockResolvedValue(500);
            await pointsController.calculateEarnPoints(req, res);
            expect(res.json).toHaveBeenCalledWith({ earn_points: 500 });
        });
    });

    describe('calculateUsablePoints', () => {
        test('사용 가능 포인트를 계산한다', async () => {
            req.query = { amount: '10000', store_id: '1' };
            mockService.calculateUsablePoints.mockResolvedValue({ usable: 300 });
            await pointsController.calculateUsablePoints(req, res);
            expect(res.json).toHaveBeenCalledWith({ usable: 300 });
        });
    });

    describe('getStoreSettings', () => {
        test('매장 포인트 설정을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreSettings.mockResolvedValue({ rate: 5 });
            await pointsController.getStoreSettings(req, res);
            expect(res.json).toHaveBeenCalledWith({ rate: 5 });
        });
    });

    describe('updateStoreSettings', () => {
        test('매장 포인트 설정을 업데이트한다', async () => {
            req.params.storeId = '1';
            req.body = { rate: 10 };
            mockService.updateStoreSettings.mockResolvedValue({ rate: 10 });
            await pointsController.updateStoreSettings(req, res);
            expect(res.json).toHaveBeenCalledWith({ rate: 10 });
        });
    });

    describe('adminEarn', () => {
        test('admin이 수동 적립을 수행한다', async () => {
            req.user.role = 'admin';
            req.body = { store_id: 1, amount: 1000, toss_user_key: 'tk_123' };
            mockService.adminEarn.mockResolvedValue({ success: true });
            await pointsController.adminEarn(req, res, next);
            expect(res.json).toHaveBeenCalled();
        });

        test('super_admin이 수동 적립을 수행한다', async () => {
            req.user.role = 'super_admin';
            req.body = { store_id: 1, amount: 500, phone: '01012345678' };
            mockService.adminEarn.mockResolvedValue({ success: true });
            await pointsController.adminEarn(req, res, next);
            expect(res.json).toHaveBeenCalled();
        });

        test('일반 사용자는 접근 불가', async () => {
            req.user.role = 'owner';
            req.body = { store_id: 1, amount: 1000 };
            await pointsController.adminEarn(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });

        test('store_id 없으면 400', async () => {
            req.user.role = 'super_admin';
            req.body = { amount: 1000 };
            await pointsController.adminEarn(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        });
    });

    describe('adminDeduct', () => {
        test('super_admin이 수동 차감을 수행한다', async () => {
            req.user.role = 'super_admin';
            req.body = { store_id: 1, amount: 500, toss_user_key: 'tk_123' };
            mockService.adminDeduct.mockResolvedValue({ success: true });
            await pointsController.adminDeduct(req, res, next);
            expect(res.json).toHaveBeenCalled();
        });

        test('admin은 접근 불가 (super_admin 전용)', async () => {
            req.user.role = 'admin';
            req.body = { store_id: 1, amount: 500 };
            await pointsController.adminDeduct(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });

        test('식별 정보 없으면 400', async () => {
            req.user.role = 'super_admin';
            req.body = { store_id: 1, amount: 500 };
            await pointsController.adminDeduct(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        });
    });
});

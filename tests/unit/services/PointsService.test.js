jest.mock('../../../config/prisma', () => ({
    user_points: { findFirst: jest.fn() },
    store_customers: { findFirst: jest.fn() },
}));
jest.mock('../../../repositories/Point');
jest.mock('../../../repositories/StoreTier');

const PointsService = require('../../../services/PointsService');
const prisma = require('../../../config/prisma');
const Point = require('../../../repositories/Point');
const StoreTier = require('../../../repositories/StoreTier');

describe('PointsService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new PointsService();
    });

    describe('getBalance', () => {
        test('포인트 잔액을 조회하여 반환한다', async () => {
            Point.getBalance.mockResolvedValue({ total_points: 5000 });
            const result = await svc.getBalance({ user_id: 1 });
            expect(Point.getBalance).toHaveBeenCalledWith({ user_id: 1 });
            expect(result).toEqual({ total_points: 5000 });
        });
    });

    describe('getHistory', () => {
        test('포인트 내역과 pagination을 반환한다', async () => {
            Point.getHistory.mockResolvedValue([{ type: 'earn', amount: 100 }]);
            const result = await svc.getHistory({ user_id: 1 }, { limit: 10, offset: 0 });
            expect(result.transactions).toHaveLength(1);
            expect(result.pagination).toEqual({ limit: 10, offset: 0 });
        });

        test('기본 pagination 값을 사용한다', async () => {
            Point.getHistory.mockResolvedValue([]);
            const result = await svc.getHistory({ user_id: 1 }, {});
            expect(result.pagination).toEqual({ limit: 20, offset: 0 });
        });
    });

    describe('walletLookup', () => {
        test('포인트 잔액 + 내역을 반환한다', async () => {
            Point.getBalance.mockResolvedValue({ total_points: 1000 });
            Point.getHistory.mockResolvedValue([]);
            Point.getStoreSettings.mockResolvedValue({ earn_rate: 1.5 });

            const result = await svc.walletLookup({ user_id: 1 }, 1);
            expect(result.balance).toEqual({ total_points: 1000 });
            expect(result.store_settings).toEqual({ earn_rate: 1.5 });
        });

        test('storeId 없이 호출 시 storeSettings/tierInfo null 반환', async () => {
            Point.getBalance.mockResolvedValue({ total_points: 0 });
            Point.getHistory.mockResolvedValue([]);

            const result = await svc.walletLookup({ user_id: 1 }, null);
            expect(result.store_settings).toBeNull();
            expect(result.tier_info).toBeNull();
        });
    });

    describe('calculateEarnPoints', () => {
        test('적립 포인트를 계산하여 반환한다', async () => {
            Point.calculateEarnPoints.mockResolvedValue(150);
            const result = await svc.calculateEarnPoints(10000, 1);
            expect(result).toBe(150);
        });
    });

    describe('calculateUsablePoints', () => {
        test('사용 가능 포인트를 계산하여 반환한다', async () => {
            Point.getBalance.mockResolvedValue({ total_points: 3000 });
            Point.calculateUsablePoints.mockResolvedValue(2000);
            const result = await svc.calculateUsablePoints(10000, 1, 1);
            expect(result).toEqual({ total_points: 3000, usable_points: 2000, max_discount: 2000 });
        });
    });

    describe('getStoreSettings', () => {
        test('매장 포인트 설정을 조회한다', async () => {
            Point.getStoreSettings.mockResolvedValue({ earn_rate: 2.0 });
            const result = await svc.getStoreSettings(1);
            expect(result).toEqual({ earn_rate: 2.0 });
        });
    });

    describe('updateStoreSettings', () => {
        test('매장 포인트 설정을 업데이트한다', async () => {
            Point.updateStoreSettings.mockResolvedValue({ earn_rate: 3.0 });
            const result = await svc.updateStoreSettings(1, { earn_rate: 3.0 });
            expect(result).toEqual({ earn_rate: 3.0 });
        });
    });

    describe('adminEarn', () => {
        test('관리자 수동 적립을 호출한다', async () => {
            Point.earn.mockResolvedValue({ amount: 500 });
            const result = await svc.adminEarn({ user_id: 1 }, 1, 500, '보너스');
            expect(Point.earn).toHaveBeenCalledWith(expect.objectContaining({
                store_id: 1, amount: 500, description: '보너스'
            }));
            expect(result).toEqual({ amount: 500 });
        });

        test('기본 설명을 사용한다', async () => {
            Point.earn.mockResolvedValue({ amount: 100 });
            await svc.adminEarn({ user_id: 1 }, 1, 100);
            expect(Point.earn).toHaveBeenCalledWith(expect.objectContaining({
                description: '관리자 수동 적립'
            }));
        });
    });

    describe('adminDeduct', () => {
        test('관리자 수동 차감을 호출한다', async () => {
            Point.use.mockResolvedValue({ amount: -200 });
            const result = await svc.adminDeduct({ user_id: 1 }, 1, 200, '차감');
            expect(Point.use).toHaveBeenCalledWith(expect.objectContaining({
                store_id: 1, amount: 200, description: '차감'
            }));
            expect(result).toEqual({ amount: -200 });
        });

        test('기본 설명을 사용한다', async () => {
            Point.use.mockResolvedValue({ amount: -100 });
            await svc.adminDeduct({ user_id: 1 }, 1, 100);
            expect(Point.use).toHaveBeenCalledWith(expect.objectContaining({
                description: '관리자 수동 차감'
            }));
        });
    });
});

jest.mock('../../../config/prisma', () => ({
  user_points: { findFirst: jest.fn() },
  store_customers: { findFirst: jest.fn() },
  store_point_settings: { findUnique: jest.fn() },
  store_tier_settings: { findMany: jest.fn() },
}));
jest.mock('../../../repositories/Point');
jest.mock('../../../repositories/StoreTier');

const pointsService = require('../../../services/PointsService');
const Point = require('../../../repositories/Point');

describe('PointsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    test('포인트 잔액을 조회하여 반환한다', async () => {
      Point.getBalance.mockResolvedValue({ total_points: 5000 });
      const result = await pointsService.getBalance({ user_id: 1 });
      expect(Point.getBalance).toHaveBeenCalledWith({ user_id: 1 });
      expect(result).toEqual({ total_points: 5000 });
    });
  });

  describe('getHistory', () => {
    test('포인트 내역과 pagination을 반환한다', async () => {
      Point.getHistory.mockResolvedValue([{ type: 'earn', amount: 100 }]);
      const result = await pointsService.getHistory({ user_id: 1 }, { limit: 10, offset: 0 });
      expect(result.transactions).toHaveLength(1);
      expect(result.pagination).toEqual({ limit: 10, offset: 0 });
    });

    test('기본 pagination 값을 사용한다', async () => {
      Point.getHistory.mockResolvedValue([]);
      const result = await pointsService.getHistory({ user_id: 1 }, {});
      expect(result.pagination).toEqual({ limit: 20, offset: 0 });
    });
  });

  describe('walletLookup', () => {
    test('포인트 잔액 + 내역을 반환한다', async () => {
      Point.getBalance.mockResolvedValue({ total_points: 1000 });
      Point.getHistory.mockResolvedValue([]);
      Point.getStoreSettings.mockResolvedValue({ earn_rate: 1.5 });

      const result = await pointsService.walletLookup({ user_id: 1 }, 1);
      expect(result.balance).toEqual({ total_points: 1000 });
      expect(result.store_settings).toEqual({ earn_rate: 1.5 });
    });

    test('storeId 없이 호출 시 storeSettings/tierInfo null 반환', async () => {
      Point.getBalance.mockResolvedValue({ total_points: 0 });
      Point.getHistory.mockResolvedValue([]);

      const result = await pointsService.walletLookup({ user_id: 1 }, null);
      expect(result.store_settings).toBeNull();
      expect(result.tier_info).toBeNull();
    });
  });

  describe('calculateEarnPoints', () => {
    test('적립 포인트를 계산하여 반환한다', async () => {
      Point.calculateEarnPoints.mockResolvedValue(150);
      const result = await pointsService.calculateEarnPoints(10000, 1);
      expect(result).toBe(150);
    });
  });

  describe('calculateUsablePoints', () => {
    test('사용 가능 포인트를 계산하여 반환한다', async () => {
      Point.getBalance.mockResolvedValue({ total_points: 3000 });
      Point.calculateUsablePoints.mockResolvedValue(2000);
      const result = await pointsService.calculateUsablePoints(10000, 1, 1);
      expect(result).toEqual({ total_points: 3000, usable_points: 2000, max_discount: 2000 });
    });
  });

  describe('getStoreSettings', () => {
    test('매장 포인트 설정을 조회한다', async () => {
      Point.getStoreSettings.mockResolvedValue({ earn_rate: 2.0 });
      const result = await pointsService.getStoreSettings(1);
      expect(result).toEqual({ earn_rate: 2.0 });
    });
  });

  describe('updateStoreSettings', () => {
    test('매장 포인트 설정을 업데이트한다', async () => {
      Point.updateStoreSettings.mockResolvedValue({ earn_rate: 3.0 });
      const result = await pointsService.updateStoreSettings(1, { earn_rate: 3.0 });
      expect(result).toEqual({ earn_rate: 3.0 });
    });
  });

  describe('adminEarn', () => {
    test('관리자 수동 적립을 호출한다', async () => {
      Point.earn.mockResolvedValue({ amount: 500 });
      const result = await pointsService.adminEarn({ user_id: 1 }, 1, 500, '보너스');
      expect(Point.earn).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 1,
          amount: 500,
          description: '보너스',
        })
      );
      expect(result).toEqual({ amount: 500 });
    });

    test('기본 설명을 사용한다', async () => {
      Point.earn.mockResolvedValue({ amount: 100 });
      await pointsService.adminEarn({ user_id: 1 }, 1, 100);
      expect(Point.earn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '관리자 수동 적립',
        })
      );
    });
  });

  describe('adminDeduct', () => {
    test('관리자 수동 차감을 호출한다', async () => {
      Point.use.mockResolvedValue({ amount: -200 });
      const result = await pointsService.adminDeduct({ user_id: 1 }, 1, 200, '차감');
      expect(Point.use).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 1,
          amount: 200,
          description: '차감',
        })
      );
      expect(result).toEqual({ amount: -200 });
    });

    test('기본 설명을 사용한다', async () => {
      Point.use.mockResolvedValue({ amount: -100 });
      await pointsService.adminDeduct({ user_id: 1 }, 1, 100);
      expect(Point.use).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '관리자 수동 차감',
        })
      );
    });
  });

  describe('revertOnOrderCancel', () => {
    const baseTx = () => ({
      point_transactions: {
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      user_points: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    test('적립 포인트를 회수하고 cancel_earn을 기록한다', async () => {
      const tx = baseTx();
      tx.point_transactions.findMany.mockResolvedValue([
        { id: 10, user_point_id: 1, store_id: 2, order_id: 5, payment_id: null, type: 'earn', amount: 100 },
      ]);
      tx.user_points.findFirst.mockResolvedValue({ id: 1, total_points: 1000, lifetime_earned: 1000 });

      await pointsService.revertOnOrderCancel(5, tx);

      expect(tx.point_transactions.findMany).toHaveBeenCalledWith({
        where: { order_id: 5 },
      });
      expect(tx.user_points.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total_points: 900,
            lifetime_earned: { decrement: 100 },
          }),
        })
      );
      expect(tx.point_transactions.create.mock.calls[0][0].data).toMatchObject({
        type: 'cancel_earn',
        amount: -100,
        balance_after: 900,
        order_id: 5,
        description: '주문 취소 포인트 회수',
      });
    });

    test('사용 포인트를 복구하고 cancel_use를 기록한다', async () => {
      const tx = baseTx();
      tx.point_transactions.findMany.mockResolvedValue([
        { id: 11, user_point_id: 1, store_id: 2, order_id: 5, payment_id: 90, type: 'use', amount: -300 },
      ]);
      tx.user_points.findFirst.mockResolvedValue({ id: 1, total_points: 700, lifetime_used: 300 });

      await pointsService.revertOnOrderCancel(5, tx);

      expect(tx.user_points.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total_points: 1000,
            lifetime_used: { decrement: 300 },
          }),
        })
      );
      expect(tx.point_transactions.create.mock.calls[0][0].data).toMatchObject({
        type: 'cancel_use',
        amount: 300,
        balance_after: 1000,
        order_id: 5,
        description: '주문 취소 포인트 복구',
      });
    });

    test('이미 반전된 트랜잭션(cancel_*)은 건너뛴다', async () => {
      const tx = baseTx();
      tx.point_transactions.findMany.mockResolvedValue([
        { type: 'cancel_earn', amount: -100 },
        { type: 'cancel_use', amount: 100 },
      ]);

      await pointsService.revertOnOrderCancel(5, tx);

      expect(tx.user_points.findFirst).not.toHaveBeenCalled();
      expect(tx.point_transactions.create).not.toHaveBeenCalled();
    });

    test('해당 주문 트랜잭션이 없으면 아무것도 하지 않는다', async () => {
      const tx = baseTx();
      tx.point_transactions.findMany.mockResolvedValue([]);

      await pointsService.revertOnOrderCancel(5, tx);

      expect(tx.user_points.findFirst).not.toHaveBeenCalled();
      expect(tx.point_transactions.create).not.toHaveBeenCalled();
    });
  });

  describe('revertOnCancel (리팩터 후 동작 보존)', () => {
    test('payment_id 기반 회수 — 기존 취소 설명 유지', async () => {
      const tx = {
        point_transactions: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, user_point_id: 1, store_id: 2, order_id: 3, payment_id: 9, type: 'earn', amount: 50 },
          ]),
          create: jest.fn().mockResolvedValue({}),
        },
        user_points: {
          findFirst: jest.fn().mockResolvedValue({ id: 1, total_points: 500, lifetime_earned: 500 }),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      await pointsService.revertOnCancel(9, tx);

      expect(tx.point_transactions.findMany).toHaveBeenCalledWith({
        where: { payment_id: 9 },
      });
      expect(tx.point_transactions.create.mock.calls[0][0].data).toMatchObject({
        type: 'cancel_earn',
        description: '결제 취소 포인트 회수',
      });
    });
  });
});

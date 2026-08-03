jest.mock('../../../config/prisma', () => ({
  store_customers: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) =>
    callback({
      store_customers: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    })
  ),
}));

const loyaltyService = require('../../../services/LoyaltyService');
const prisma = require('../../../config/prisma');

describe('LoyaltyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addStampsAndCheckTier', () => {
    test('고객이 없으면 새로 생성하고 스탬프를 적립한다', async () => {
      const mockTx = {
        store_customers: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockResolvedValue({
              id: 1,
              store_id: 1,
              phone: '01012345678',
              stamp_count: 0,
              tier: 'BRONZE',
            }),
          update: jest
            .fn()
            .mockResolvedValue({
              id: 1,
              store_id: 1,
              phone: '01012345678',
              stamp_count: 1,
              tier: 'BRONZE',
            }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(mockTx));

      const result = await loyaltyService.addStampsAndCheckTier(1, '01012345678', 1);
      expect(mockTx.store_customers.create).toHaveBeenCalled();
      expect(mockTx.store_customers.update).toHaveBeenCalled();
      expect(result.stamp_count).toBe(1);
    });

    test('스탬프 10개 이상 적립 시 SILVER 등급으로 승급한다', async () => {
      const mockTx = {
        store_customers: {
          findFirst: jest
            .fn()
            .mockResolvedValue({
              id: 1,
              store_id: 1,
              phone: '01012345678',
              stamp_count: 9,
              tier: 'BRONZE',
              visit_count: 4,
            }),
          update: jest
            .fn()
            .mockResolvedValue({
              id: 1,
              store_id: 1,
              phone: '01012345678',
              stamp_count: 10,
              tier: 'SILVER',
              visit_count: 5,
            }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(mockTx));

      const result = await loyaltyService.addStampsAndCheckTier(1, '01012345678', 1);
      expect(result.tier).toBe('SILVER');
    });
  });

  describe('redeemStampsForReward', () => {
    test('스탬프가 충분하면 보상으로 교환하고 잔여 스탬프를 반환한다', async () => {
      const mockTx = {
        store_customers: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 1, store_id: 1, phone: '01012345678', stamp_count: 12 }),
          update: jest.fn().mockResolvedValue({ id: 1, stamp_count: 2 }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(mockTx));

      const result = await loyaltyService.redeemStampsForReward(1, '01012345678', 10);
      expect(result.success).toBe(true);
      expect(result.remainingStamps).toBe(2);
    });

    test('스탬프가 부족하면 에러를 발생시킨다', async () => {
      const mockTx = {
        store_customers: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 1, store_id: 1, phone: '01012345678', stamp_count: 5 }),
        },
      };
      prisma.$transaction.mockImplementation((cb) => cb(mockTx));

      await expect(loyaltyService.redeemStampsForReward(1, '01012345678', 10)).rejects.toThrow(
        '스탬프가 부족합니다.'
      );
    });
  });
});

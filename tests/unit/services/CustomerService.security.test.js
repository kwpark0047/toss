jest.mock('../../../config/prisma', () => ({
  store_customers: { findFirst: jest.fn(), upsert: jest.fn() },
  point_transactions: { findFirst: jest.fn() },
  coupons: { findFirst: jest.fn() },
  user_coupons: { create: jest.fn() },
  notifications: { create: jest.fn() },
}));
jest.mock('../../../repositories/Point', () => ({
  calculateEarnPoints: jest.fn(),
  earn: jest.fn(),
  getBalance: jest.fn(),
}));
jest.mock('../../../repositories/StoreTier', () => ({
  calculateTier: jest.fn(),
  getTiers: jest.fn(),
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  normalizePhone: jest.fn((phone) => String(phone).replace(/\D/g, '')),
  encryptPhone: jest.fn((phone) => `enc_${phone}`),
  decryptPhone: jest.fn(),
  phoneSearchCandidates: jest.fn((phone) => [`enc_${phone}`, phone]),
}));

const prisma = require('../../../config/prisma');
const Point = require('../../../repositories/Point');
const StoreTier = require('../../../repositories/StoreTier');
const CustomerService = require('../../../services/CustomerService');

describe('CustomerService loyalty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.point_transactions.findFirst.mockResolvedValue(null);
    prisma.store_customers.findFirst.mockResolvedValue(null);
    prisma.store_customers.upsert.mockResolvedValue({ visit_count: 1, total_spent: 5000 });
    prisma.coupons.findFirst.mockResolvedValue(null);
    prisma.notifications.create.mockResolvedValue({});
    StoreTier.calculateTier.mockResolvedValue({ tier_name: '일반', earn_rate: 1 });
    StoreTier.getTiers.mockResolvedValue([]);
  });

  test('신규 고객은 매출·포인트를 계산하고 고객을 upsert한다', async () => {
    Point.calculateEarnPoints.mockResolvedValue(50);
    Point.earn.mockResolvedValue({ balance: 150 });

    const service = new CustomerService();
    const result = await service.phoneJoin({
      phone: '01012345678',
      store_id: 3,
      order_id: 10,
      total_amount: 5000,
    });

    expect(Point.calculateEarnPoints).toHaveBeenCalledWith(5000, 3, { phone: '01012345678' });
    expect(prisma.store_customers.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ total_spent: 5000 }),
        update: expect.objectContaining({ total_spent: { increment: 5000 } }),
      })
    );
    expect(result).toMatchObject({
      is_new_customer: true,
      points_earned: 50,
      total_points: 150,
      customer_tier: '일반',
    });
  });

  test('이미 적립된 주문이면 중복 적립을 차단하고 아무것도 변경하지 않는다', async () => {
    prisma.point_transactions.findFirst.mockResolvedValue({ id: 99 });

    const service = new CustomerService();
    const result = await service.phoneJoin({
      phone: '01012345678',
      store_id: 3,
      order_id: 10,
      total_amount: 5000,
    });

    expect(result.duplicate).toBe(true);
    expect(prisma.store_customers.upsert).not.toHaveBeenCalled();
    expect(prisma.user_coupons.create).not.toHaveBeenCalled();
  });

  test('order_id가 없으면 중복 적립 검사를 건너뛰고 일반 적립을 수행한다', async () => {
    Point.calculateEarnPoints.mockResolvedValue(0);
    Point.getBalance.mockResolvedValue({ total_points: 200 });

    const service = new CustomerService();
    const result = await service.phoneJoin({
      phone: '01012345678',
      store_id: 3,
      total_amount: 5000,
    });

    expect(prisma.point_transactions.findFirst).not.toHaveBeenCalled();
    expect(result.total_points).toBe(200);
  });
});

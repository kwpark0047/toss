jest.mock('../../../config/prisma', () => ({
  orders: { findUnique: jest.fn() },
  store_customers: { findFirst: jest.fn() },
  notifications: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../repositories/Point', () => ({ calculateEarnPoints: jest.fn() }));
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

describe('CustomerService loyalty security', () => {
  let tx;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      point_transactions: { findFirst: jest.fn(), create: jest.fn() },
      store_customers: { upsert: jest.fn() },
      user_points: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      coupons: { findFirst: jest.fn() },
      user_coupons: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    prisma.orders.findUnique.mockResolvedValue({
      store_id: 3,
      customer_phone: '01012345678',
      total_amount: 5000,
    });
    prisma.store_customers.findFirst.mockResolvedValue(null);
    prisma.notifications.create.mockResolvedValue({});
    StoreTier.calculateTier.mockResolvedValue({ tier_name: '일반', earn_rate: 1 });
    StoreTier.getTiers.mockResolvedValue([]);
    Point.calculateEarnPoints.mockResolvedValue(50);
    tx.point_transactions.findFirst.mockResolvedValue(null);
    tx.point_transactions.create.mockResolvedValue({ id: 1 });
    tx.store_customers.upsert.mockResolvedValue({ visit_count: 1, total_spent: 5000 });
    tx.user_points.findFirst.mockResolvedValue({ id: 7, total_points: 100 });
    tx.coupons.findFirst.mockResolvedValue(null);
  });

  test('derives spend and points from the capability-bound order, not client total', async () => {
    const service = new CustomerService();
    const result = await service.phoneJoin(
      { phone: '01012345678', store_id: 3, order_id: 10, total_amount: 99999999 },
      { orderId: 10, storeId: 3 }
    );

    expect(Point.calculateEarnPoints).toHaveBeenCalledWith(5000, 3, { phone: '01012345678' });
    expect(tx.store_customers.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ total_spent: 5000 }),
        update: expect.objectContaining({ total_spent: { increment: 5000 } }),
      })
    );
    expect(tx.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_id: 10,
          amount: 50,
          balance_after: 150,
          reference_id: 'order:10:loyalty-earn',
        }),
      })
    );
    expect(result.points_earned).toBe(50);
  });

  test('requires a matching order capability', async () => {
    const service = new CustomerService();
    await expect(
      service.phoneJoin(
        { phone: '01012345678', store_id: 3, order_id: 10 },
        { orderId: 11, storeId: 3 }
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.orders.findUnique).not.toHaveBeenCalled();
  });

  test('requires an order instead of accepting arbitrary loyalty activity', async () => {
    const service = new CustomerService();
    await expect(
      service.phoneJoin({ phone: '01012345678', store_id: 3, total_amount: 5000 }, null)
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('does not mutate loyalty data when the order already has an earn marker', async () => {
    tx.point_transactions.findFirst.mockResolvedValue({ id: 99 });
    const service = new CustomerService();
    const result = await service.phoneJoin(
      { phone: '01012345678', store_id: 3, order_id: 10 },
      { orderId: 10, storeId: 3 }
    );

    expect(result).toEqual(expect.objectContaining({ duplicate: true }));
    expect(tx.store_customers.upsert).not.toHaveBeenCalled();
    expect(tx.point_transactions.create).not.toHaveBeenCalled();
  });
});

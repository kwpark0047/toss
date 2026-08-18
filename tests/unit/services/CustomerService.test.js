jest.mock('../../../config/prisma', () => ({
  store_customers: { findFirst: jest.fn() },
  user_points: { findFirst: jest.fn() },
  orders: { findMany: jest.fn() },
  point_transactions: { findMany: jest.fn() },
  user_coupons: { findMany: jest.fn() },
  store_tier_settings: { findMany: jest.fn() },
  stores: { findMany: jest.fn() },
}));
jest.mock('../../../repositories/StoreCustomer', () => ({ findById: jest.fn() }));
jest.mock('../../../repositories/Point', () => ({ calculateEarnPoints: jest.fn() }));
jest.mock('../../../repositories/StoreTier', () => ({
  calculateTier: jest.fn(),
  getTiers: jest.fn(),
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  normalizePhone: jest.fn((phone) => String(phone || '').replace(/\D/g, '')),
  encryptPhone: jest.fn((phone) => `enc_${phone}`),
  phoneSearchCandidates: jest.fn((phone) => [`enc_${phone}`, phone]),
}));

const prisma = require('../../../config/prisma');
const StoreCustomer = require('../../../repositories/StoreCustomer');
const CustomerService = require('../../../services/CustomerService');

describe('CustomerService customer data boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StoreCustomer.findById.mockResolvedValue({
      id: 7,
      store_id: 3,
      customer_phone: 'enc_01012345678',
      total_spent: 10000,
    });
    prisma.store_customers.findFirst.mockResolvedValue({
      id: 7,
      store_id: 3,
      customer_phone: 'enc_01012345678',
      total_spent: 10000,
    });
    prisma.user_points.findFirst.mockResolvedValue(null);
    prisma.orders.findMany.mockResolvedValue([]);
    prisma.point_transactions.findMany.mockResolvedValue([]);
    prisma.user_coupons.findMany.mockResolvedValue([]);
    prisma.store_tier_settings.findMany.mockResolvedValue([]);
  });

  it('고객 이력의 쿠폰 조회를 해당 매장으로 제한한다', async () => {
    await new CustomerService().getHistory(3, 7);

    expect(prisma.user_coupons.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ coupons: { store_id: 3 } }),
      })
    );
  });

  it('위치 좌표 범위를 벗어나면 매장 조회를 하지 않는다', async () => {
    await expect(
      new CustomerService().updateLocation({
        phone: '01012345678',
        latitude: 91,
        longitude: 127,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.stores.findMany).not.toHaveBeenCalled();
  });

  it('짧거나 잘못된 FCM 토큰을 거부한다', async () => {
    await expect(
      new CustomerService().registerFcmToken({
        phone: '01012345678',
        store_id: 3,
        fcm_token: 'short',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

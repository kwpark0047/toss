jest.mock('../../../config/prisma', () => ({
  user_coupons: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require('../../../config/prisma');
const Coupon = require('../../../repositories/Coupon');

describe('Coupon.useCoupon', () => {
  beforeEach(() => jest.clearAllMocks());

  test('미사용, 미만료, 동일 소유자 쿠폰만 조건부로 소비한다', async () => {
    const now = new Date('2026-07-29T00:00:00.000Z');
    const usedCoupon = { id: 1, status: 'USED' };
    prisma.user_coupons.updateMany.mockResolvedValue({ count: 1 });
    prisma.user_coupons.findUnique.mockResolvedValue(usedCoupon);

    const result = await Coupon.useCoupon(1, 100, prisma, {
      customerPhone: 'enc:stored',
      couponId: 7,
      now,
    });

    expect(prisma.user_coupons.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: 'UNUSED',
        expires_at: { gte: now },
        customer_phone: 'enc:stored',
        coupon_id: 7,
      },
      data: { status: 'USED', used_at: now },
    });
    expect(result).toBe(usedCoupon);
  });

  test('다른 주문이 먼저 소비한 쿠폰은 null을 반환한다', async () => {
    prisma.user_coupons.updateMany.mockResolvedValue({ count: 0 });

    await expect(Coupon.useCoupon(1, 101)).resolves.toBeNull();
    expect(prisma.user_coupons.findUnique).not.toHaveBeenCalled();
  });
});

const prisma = require('../config/prisma');

/**
 * [쿠폰 모델]
 * 쿠폰 정의 및 사용자별 쿠폰 발급/사용을 관리합니다.
 */
const Coupon = {
  /**
   * [쿠폰 마스터 생성]
   */
  create: async (data) => {
    return await prisma.coupons.create({ data });
  },

  /**
   * [매장별 유효한 쿠폰 목록 조회]
   */
  getStoreCoupons: async (storeId) => {
    return await prisma.coupons.findMany({
      where: { store_id: parseInt(storeId), is_active: 1 },
    });
  },

  /**
   * [고객에게 쿠폰 발급]
   */
  issueToCustomer: async (customerPhone, couponId) => {
    const coupon = await prisma.coupons.findUnique({ where: { id: couponId } });
    if (!coupon) throw new Error('존재하지 않는 쿠폰입니다.');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + coupon.valid_days);

    return await prisma.user_coupons.create({
      data: {
        customer_phone: customerPhone,
        coupon_id: couponId,
        status: 'UNUSED',
        expires_at: expiresAt,
      },
    });
  },

  /**
   * [고객의 사용 가능한 쿠폰 목록 조회]
   */
  getCustomerCoupons: async (customerPhone, storeId = null) => {
    const where = {
      customer_phone: customerPhone,
      status: 'UNUSED',
      expires_at: { gte: new Date() },
    };

    if (storeId) {
      where.coupons = { store_id: parseInt(storeId) };
    }

    return await prisma.user_coupons.findMany({
      where,
      include: { coupons: true },
      orderBy: { expires_at: 'asc' },
    });
  },

  /**
   * [사용자 쿠폰 상세 조회 (쿠폰 정보 포함)]
   */
  findUserCoupon: async (userCouponId) => {
    return await prisma.user_coupons.findUnique({
      where: { id: parseInt(userCouponId) },
      include: { coupons: true },
    });
  },

  /**
   * [쿠폰 사용 처리]
   * 조건부 updateMany로 미사용/미만료/동일 소유자 쿠폰만 소비한다.
   * 경쟁에서 패배(count 0)하면 null, 성공하면 소비된 쿠폰을 반환한다.
   * prismaInstance/options는 테스트 주입용이며, 기본값으로 모듈 prisma를 쓴다.
   */
  useCoupon: async (userCouponId, orderId, prismaInstance = prisma, options = {}) => {
    const now = options.now || new Date();
    const where = {
      id: parseInt(userCouponId),
      status: 'UNUSED',
      expires_at: { gte: now },
    };
    if (options.customerPhone) where.customer_phone = options.customerPhone;
    if (options.couponId) where.coupon_id = options.couponId;

    const updated = await prismaInstance.user_coupons.updateMany({
      where,
      data: { status: 'USED', used_at: now },
    });

    if (!updated.count) return null;

    return await prismaInstance.user_coupons.findUnique({
      where: { id: parseInt(userCouponId) },
    });
  },
};

module.exports = Coupon;

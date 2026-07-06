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
            where: { store_id: parseInt(storeId), is_active: 1 }
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
                expires_at: expiresAt
            }
        });
    },

    /**
     * [고객의 사용 가능한 쿠폰 목록 조회]
     */
    getCustomerCoupons: async (customerPhone, storeId = null) => {
        const where = {
            customer_phone: customerPhone,
            status: 'UNUSED',
            expires_at: { gte: new Date() }
        };

        if (storeId) {
            where.coupons = { store_id: parseInt(storeId) };
        }

        return await prisma.user_coupons.findMany({
            where,
            include: { coupons: true },
            orderBy: { expires_at: 'asc' }
        });
    },

    /**
     * [사용자 쿠폰 상세 조회 (쿠폰 정보 포함)]
     */
    findUserCoupon: async (userCouponId) => {
        return await prisma.user_coupons.findUnique({
            where: { id: parseInt(userCouponId) },
            include: { coupons: true }
        });
    },

    /**
     * [쿠폰 사용 처리]
     */
    useCoupon: async (userCouponId, _orderId) => {
        return await prisma.user_coupons.update({
            where: { id: parseInt(userCouponId) },
            data: {
                status: 'USED',
                used_at: new Date()
            }
        });
    }
};

module.exports = Coupon;

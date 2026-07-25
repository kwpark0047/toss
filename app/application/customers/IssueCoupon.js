class IssueCoupon {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  async execute(storeId, customerId, couponId) {
    const customer = await this.customerRepository.findById(parseInt(storeId), parseInt(customerId));
    if (!customer) return { error: '고객 정보 없음', status: 404 };

    const coupon = await this.customerRepository.findCouponById(parseInt(storeId), parseInt(couponId));
    if (!coupon) return { error: '쿠폰 정보 없음', status: 404 };

    const alreadyHas = await this.customerRepository.checkDuplicateCoupon(customer.customer_phone, coupon.id);
    if (alreadyHas) return { error: '이미 보유 중인 쿠폰입니다.', status: 409 };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (coupon.valid_days || 30));

    const issued = await this.customerRepository.issueCoupon(customer.customer_phone, coupon.id, expiresAt);
    return { issued, couponName: coupon.name };
  }
}

module.exports = IssueCoupon;

class PhoneJoin {
  constructor({ customerRepository, pointService, storeTierService }) {
    this.customerRepository = customerRepository;
    this.pointService = pointService;
    this.storeTierService = storeTierService;
  }

  async execute({ phone, store_id, order_id, total_amount }) {
    const { normalizePhone } = require('../../utils/phoneEncryption');
    const normalizedPhone = normalizePhone(phone);
    const storeId = parseInt(store_id);
    const amount = parseInt(total_amount) || 0;
    const orderId = order_id ? parseInt(order_id) : null;

    if (orderId) {
      const alreadyEarned = await this.customerRepository.checkDuplicateEarn(orderId);
      if (alreadyEarned) {
        return { duplicate: true, message: '이미 포인트가 적립된 주문입니다.' };
      }
    }

    const existingCustomer = await this.customerRepository.findByPhone(storeId, normalizedPhone);
    const isNewCustomer = !existingCustomer;

    const newTotalSpent = (existingCustomer?.total_spent || 0) + amount;
    const newTier = await this.storeTierService.calculateTier(storeId, newTotalSpent);

    const customer = await this.customerRepository.upsert({
      store_id: storeId,
      customer_phone: normalizedPhone,
      visit_count: 1,
      total_spent: amount,
      tier: newTier.tier_name,
      last_visit_at: new Date(),
    });

    const earnPoints = amount > 0
      ? await this.pointService.calculateEarnPoints(amount, storeId, { phone: normalizedPhone })
      : 0;

    let pointResult = null;
    let totalPoints = 0;
    if (earnPoints > 0) {
      pointResult = await this.pointService.earn({
        identifier: { phone: normalizedPhone },
        store_id: storeId,
        order_id: orderId,
        amount: earnPoints,
        description: `주문 적립 (${amount.toLocaleString()}원)`,
      });
      totalPoints = pointResult.balance;
    } else {
      const balance = await this.pointService.getBalance({ phone: normalizedPhone });
      totalPoints = balance.total_points;
    }

    let welcomeCoupon = null;
    if (isNewCustomer) {
      const coupon = await this.customerRepository.findWelcomeCoupon(storeId);
      if (coupon) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + coupon.valid_days);
        await this.customerRepository.issueCoupon(normalizedPhone, coupon.id, expiresAt);
        welcomeCoupon = { name: coupon.name, amount: coupon.amount, type: coupon.type };
      }
    }

    const allTiers = await this.storeTierService.getTiers(storeId);
    const nextTier = allTiers
      .filter((t) => t.min_spent > newTotalSpent)
      .sort((a, b) => a.min_spent - b.min_spent)[0] || null;

    return {
      is_new_customer: isNewCustomer,
      points_earned: earnPoints,
      total_points: totalPoints,
      customer_tier: newTier.tier_name,
      earn_rate: newTier.earn_rate,
      visit_count: customer.visit_count,
      total_spent: customer.total_spent,
      welcome_coupon: welcomeCoupon,
      next_tier: nextTier ? { name: nextTier.tier_name, remaining: nextTier.min_spent - newTotalSpent } : null,
      socket_channel: `customer-orders-${normalizedPhone}`,
    };
  }
}

module.exports = PhoneJoin;

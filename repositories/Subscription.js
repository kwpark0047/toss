const prisma = require('../config/prisma');

/**
 * Subscription (구독) 리포지토리
 * 매장별 구독 상태, 기간, 결제 정보 관리
 */
class SubscriptionRepository {
  /**
   * 매장 ID로 구독 조회
   */
  async findByStoreId(storeId) {
    return await prisma.subscription.findUnique({
      where: { store_id: storeId },
      include: { plan: true },
    });
  }

  /**
   * 구독 ID로 조회
   */
  async findById(id) {
    return await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, store: { select: { id: true, name: true, user_id: true } } },
    });
  }

  /**
   * 구독 생성
   */
  async create(data) {
    const {
      store_id,
      plan_id,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      trial_ends_at,
      payment_method_id,
      metadata,
    } = data;

    return await prisma.subscription.create({
      data: {
        store_id,
        plan_id,
        status: status || 'active',
        billing_cycle: billing_cycle || 'MONTHLY',
        current_period_start: current_period_start || new Date(),
        current_period_end,
        trial_ends_at,
        payment_method_id,
        metadata,
      },
      include: { plan: true },
    });
  }

  /**
   * 구독 수정
   */
  async update(id, data) {
    return await prisma.subscription.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      include: { plan: true },
    });
  }

  /**
   * 구독 상태 변경
   */
  async updateStatus(id, status, additionalData = {}) {
    return await prisma.subscription.update({
      where: { id },
      data: {
        status,
        ...additionalData,
        updated_at: new Date(),
      },
      include: { plan: true },
    });
  }

  /**
   * 결제 성공 시 구독 갱신
   */
  async renewSubscription(id, nextPeriodEnd, paymentMethodId = null) {
    return await prisma.subscription.update({
      where: { id },
      data: {
        current_period_start: new Date(),
        current_period_end: nextPeriodEnd,
        last_payment_at: new Date(),
        next_payment_at: nextPeriodEnd,
        status: 'active',
        payment_method_id: paymentMethodId,
        updated_at: new Date(),
      },
      include: { plan: true },
    });
  }

  /**
   * 구독 취소 (즉시 또는 기간 만료 시)
   */
  async cancel(id, cancelAt = null) {
    const data = {
      status: 'canceled',
      canceled_at: new Date(),
      cancel_at: cancelAt,
      auto_renew: false,
      updated_at: new Date(),
    };

    if (cancelAt && cancelAt > new Date()) {
      data.status = 'active'; // 기간 만료까지 활성 유지
    }

    return await prisma.subscription.update({
      where: { id },
      data,
      include: { plan: true },
    });
  }

  /**
   * 연체/만료 구독 조회 (배치 처리용)
   */
  async findPastDue() {
    return await prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing', 'past_due'] },
        current_period_end: { lt: new Date() },
      },
      include: { plan: true, store: { select: { id: true, name: true, user_id: true } } },
    });
  }

  /**
   * 체험판 종료 임박 구독 조회
   */
  async findTrialEndingSoon(days = 3) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return await prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trial_ends_at: { lte: cutoff, gt: new Date() },
      },
      include: { plan: true, store: { select: { id: true, name: true, user_id: true } } },
    });
  }

  /**
   * 만료 예정 구독 조회 (갱신 알림용)
   */
  async findExpiringSoon(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return await prisma.subscription.findMany({
      where: {
        status: 'active',
        auto_renew: true,
        current_period_end: { lte: cutoff, gt: new Date() },
      },
      include: { plan: true, store: { select: { id: true, name: true, user_id: true } } },
    });
  }
}

module.exports = new SubscriptionRepository();

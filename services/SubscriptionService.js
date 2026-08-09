const SubscriptionRepository = require('../repositories/Subscription');
const PlanRepository = require('../repositories/Plan');
const TossAPI = require('../utils/toss');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

/**
 * Subscription 서비스 - 구독 라이프사이클 관리
 * Toss BrandPay 정기결제 연동
 */
class SubscriptionService {
  /**
   * 구독 생성 (첫 결제 후)
   */
  async createSubscription(
    storeId,
    planId,
    billingCycle = 'MONTHLY',
    paymentMethodId = null,
    trialDays = 0
  ) {
    const plan = await PlanRepository.findById(planId);
    if (!plan) {
      throw new AppError('플랜을 찾을 수 없습니다', 404);
    }

    const now = new Date();
    const periodStart =
      trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'YEARLY' ? 12 : 1));

    const subscription = await SubscriptionRepository.create({
      store_id: storeId,
      plan_id: planId,
      status: trialDays > 0 ? 'trialing' : 'active',
      billing_cycle: billingCycle,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_ends_at: trialDays > 0 ? periodStart : null,
      payment_method_id: paymentMethodId,
    });

    // stores 테이블의 플랜/구독 정보도 업데이트
    await prisma.stores.update({
      where: { id: storeId },
      data: {
        plan: plan.name,
        subscription_id: subscription.id,
        billing_cycle: billingCycle,
        trial_ends_at: trialDays > 0 ? periodStart : null,
        plan_expires_at: periodEnd,
        auto_renew: true,
        payment_method_id: paymentMethodId,
      },
    });

    logger.info({ storeId, planId, billingCycle }, '구독 생성됨');
    return subscription;
  }

  /**
   * 구독 조회 (플랜 포함)
   */
  async getSubscription(storeId) {
    return await SubscriptionRepository.findByStoreId(storeId);
  }

  /**
   * 구독 상세 조회 (ID로)
   */
  async getSubscriptionById(id) {
    return await SubscriptionRepository.findById(id);
  }

  /**
   * 구독 갱신 (결제 성공 시)
   */
  async renewSubscription(subscriptionId, paymentMethodId = null) {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new AppError('구독을 찾을 수 없습니다', 404);
    }

    const plan = await PlanRepository.findById(subscription.plan_id);
    const now = new Date();
    const periodStart =
      subscription.current_period_end > now ? subscription.current_period_end : now;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + (subscription.billing_cycle === 'YEARLY' ? 12 : 1));

    const renewed = await SubscriptionRepository.renewSubscription(
      subscriptionId,
      periodEnd,
      paymentMethodId
    );

    // stores 테이블 업데이트
    await prisma.stores.update({
      where: { id: subscription.store_id },
      data: {
        plan: plan.name,
        plan_expires_at: periodEnd,
        last_payment_at: new Date(),
        next_payment_at: periodEnd,
        payment_method_id: paymentMethodId || subscription.payment_method_id,
      },
    });

    logger.info({ subscriptionId, storeId: subscription.store_id }, '구독 갱신됨');
    return renewed;
  }

  /**
   * 구독 취소 (즉시 또는 기간 만료 시)
   */
  async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new AppError('구독을 찾을 수 없습니다', 404);
    }

    const cancelAt = cancelAtPeriodEnd ? subscription.current_period_end : new Date();

    const canceled = await SubscriptionRepository.cancel(subscriptionId, cancelAt);

    // stores 테이블 업데이트
    await prisma.stores.update({
      where: { id: subscription.store_id },
      data: {
        auto_renew: false,
        plan_expires_at: cancelAt,
      },
    });

    logger.info(
      { subscriptionId, storeId: subscription.store_id, cancelAtPeriodEnd },
      '구독 취소됨'
    );
    return canceled;
  }

  /**
   * 플랜 변경 (업그레이드/다운그레이드)
   * 즉시 적용 시 proration 계산 필요
   */
  async changePlan(subscriptionId, newPlanId, prorate = true) {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new AppError('구독을 찾을 수 없습니다', 404);
    }

    const newPlan = await PlanRepository.findById(newPlanId);
    if (!newPlan) {
      throw new AppError('플랜을 찾을 수 없습니다', 404);
    }

    // 다운그레이드 시 현재 기간 만료 후 적용 권장
    const isDowngrade = newPlan.price_monthly < subscription.plan.price_monthly;
    const applyNow = !isDowngrade || !prorate;

    if (applyNow) {
      // 즉시 적용: 현재 기간 비례 환불/차액 계산 후 새 플랜으로 갱신
      const now = new Date();
      const remainingDays = Math.max(
        0,
        Math.ceil((subscription.current_period_end - now) / (1000 * 60 * 60 * 24))
      );
      const totalDays = Math.ceil(
        (subscription.current_period_end - subscription.current_period_start) /
          (1000 * 60 * 60 * 24)
      );
      const unusedRatio = remainingDays / totalDays;

      // 구독 정보 업데이트
      const periodStart = now;
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + (subscription.billing_cycle === 'YEARLY' ? 12 : 1));

      await SubscriptionRepository.update(subscriptionId, {
        plan_id: newPlanId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        status: 'active',
        updated_at: new Date(),
      });

      // stores 업데이트
      await prisma.stores.update({
        where: { id: subscription.store_id },
        data: {
          plan: newPlan.name,
          plan_expires_at: periodEnd,
        },
      });

      logger.info(
        { subscriptionId, oldPlan: subscription.plan_id, newPlan: newPlanId },
        '플랜 즉시 변경됨'
      );
    } else {
      // 다운그레이드: 현재 기간 만료 시 적용 예약
      await SubscriptionRepository.update(subscriptionId, {
        metadata: {
          ...subscription.metadata,
          pending_plan_change: {
            plan_id: newPlanId,
            scheduled_at: subscription.current_period_end.toISOString(),
          },
        },
        updated_at: new Date(),
      });

      logger.info({ subscriptionId, newPlan: newPlanId }, '플랜 변경 예약됨 (기간 만료 시 적용)');
    }

    return await this.getSubscriptionById(subscriptionId);
  }

  /**
   * 결제 수단 업데이트 (Toss billingKey)
   */
  async updatePaymentMethod(subscriptionId, billingKey) {
    const subscription = await SubscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new AppError('구독을 찾을 수 없습니다', 404);
    }

    await SubscriptionRepository.update(subscriptionId, {
      payment_method_id: billingKey,
      updated_at: new Date(),
    });

    await prisma.stores.update({
      where: { id: subscription.store_id },
      data: { payment_method_id: billingKey },
    });

    logger.info({ subscriptionId }, '결제 수단 업데이트됨');
    return await this.getSubscriptionById(subscriptionId);
  }

  /**
   * 연체/만료 구독 배치 처리
   */
  async processOverdueSubscriptions() {
    const overdue = await SubscriptionRepository.findPastDue();
    logger.info({ count: overdue.length }, '연체 구독 처리 시작');

    for (const sub of overdue) {
      try {
        // 연체 상태가 7일 이상이면 구독 정지
        const daysOverdue = Math.ceil(
          (new Date() - sub.current_period_end) / (1000 * 60 * 60 * 24)
        );

        if (daysOverdue >= 7) {
          await SubscriptionRepository.updateStatus(sub.id, 'past_due');
          await prisma.stores.update({
            where: { id: sub.store_id },
            data: { plan: 'free', auto_renew: false },
          });
          logger.warn({ subscriptionId: sub.id, daysOverdue }, '구독 정지 (7일 연체)');
        } else {
          await SubscriptionRepository.updateStatus(sub.id, 'past_due');
          logger.info({ subscriptionId: sub.id, daysOverdue }, '연체 상태 표시');
        }
      } catch (e) {
        logger.error({ subscriptionId: sub.id, error: e.message }, '연체 처리 실패');
      }
    }
  }

  /**
   * 체험판 종료 임박 알림
   */
  async notifyTrialEnding() {
    const ending = await SubscriptionRepository.findTrialEndingSoon(3);
    logger.info({ count: ending.length }, '체험판 종료 임박 알림 발송');
    // 알림 발송 로직 (별도 notification 서비스 연동)
    return ending;
  }

  /**
   * 만료 예정 갱신 알림
   */
  async notifyExpiringSoon() {
    const expiring = await SubscriptionRepository.findExpiringSoon(7);
    logger.info({ count: expiring.length }, '구독 만료 예정 알림 발송');
    // 알림 발송 로직
    return expiring;
  }

  /**
   * 구독 통계 (관리자 대시보드용)
   */
  async getStats() {
    const [total, active, trialing, past_due, canceled, expired, byPlan] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'trialing' } }),
      prisma.subscription.count({ where: { status: 'past_due' } }),
      prisma.subscription.count({ where: { status: 'canceled' } }),
      prisma.subscription.count({ where: { status: 'expired' } }),
      prisma.subscription.groupBy({
        by: ['plan_id'],
        _count: { plan_id: true },
      }),
    ]);

    // 플랜별 이름 매핑
    const plans = await prisma.plan.findMany({
      select: { id: true, name: true, display_name: true },
    });
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    const byPlanMapped = byPlan.map((bp) => ({
      plan_id: bp.plan_id,
      plan_name: planMap[bp.plan_id]?.name,
      display_name: planMap[bp.plan_id]?.display_name,
      count: bp._count.plan_id,
    }));

    return {
      total,
      active,
      trialing,
      past_due,
      canceled,
      expired,
      by_plan: byPlanMapped,
    };
  }
}

module.exports = new SubscriptionService();

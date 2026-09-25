const SubscriptionRepository = require('../repositories/Subscription');
const PlanRepository = require('../repositories/Plan');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

/**
 * Subscription 서비스 - 구독 라이프사이클 관리
 * Toss BrandPay 정기결제 연동
 */
class SubscriptionService {
  /**
   * [내부 헬퍼] stores ↔ store_subscriptions 동기화
   * - plan이 전달되면 stores.plan에도 반영 (여러 소비처가 stores.plan을 읽음)
   * - 구독 세부 필드는 store_subscriptions에 upsert
   */
  async _syncStoreSubscription(storeId, data) {
    const { plan } = data;

    if (plan !== undefined) {
      await prisma.stores.update({ where: { id: storeId }, data: { plan } });
    }

    await prisma.store_subscriptions.upsert({
      where: { store_id: storeId },
      create: { store_id: storeId, ...data },
      update: { ...data },
    });
  }

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

    // store_subscriptions에 구독 정보 upsert (plan은 stores에도 반영)
    await this._syncStoreSubscription(storeId, {
      plan: plan.name,
      subscription_id: subscription.id,
      billing_cycle: billingCycle,
      trial_ends_at: trialDays > 0 ? periodStart : null,
      plan_expires_at: periodEnd,
      auto_renew: true,
      payment_method_id: paymentMethodId,
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

    // 갱신된 구독 정보 upsert (plan은 stores에도 반영)
    await this._syncStoreSubscription(subscription.store_id, {
      plan: plan.name,
      plan_expires_at: periodEnd,
      last_payment_at: new Date(),
      next_payment_at: periodEnd,
      payment_method_id: paymentMethodId || subscription.payment_method_id,
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

    // 취소 상태 upsert (plan 미포함 → stores.plan은 변경하지 않음)
    await this._syncStoreSubscription(subscription.store_id, {
      auto_renew: false,
      plan_expires_at: cancelAt,
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

      // 변경된 플랜 upsert (plan은 stores에도 반영)
      await this._syncStoreSubscription(subscription.store_id, {
        plan: newPlan.name,
        plan_expires_at: periodEnd,
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

    // 결제 수단 변경 upsert (plan 미포함 → stores.plan은 변경하지 않음)
    await this._syncStoreSubscription(subscription.store_id, {
      payment_method_id: billingKey,
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
          await this._syncStoreSubscription(sub.store_id, {
            plan: 'free',
            auto_renew: false,
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
   * [내부 헬퍼] 월 등가 반복 금액 계산
   * MONTHLY → price_monthly, YEARLY → price_yearly/12
   * (price_yearly 미설정 플랜은 price_monthly×12로 폴백)
   */
  _monthlyAmount(sub) {
    const plan = sub.plan || {};
    const monthly = plan.price_monthly || 0;
    const yearly = plan.price_yearly || 0;
    if (sub.billing_cycle === 'YEARLY') {
      const annualAmount = yearly > 0 ? yearly : monthly * 12;
      return Math.round(annualAmount / 12);
    }
    return monthly;
  }

  /**
   * 구독 통계 (관리자 대시보드용) — 카운트 + MRR(월반복매출) 지표
   * - MRR: active 구독의 월 등가 반복 금액 합산 (YEARLY는 /12, trialing은 과금 전이므로 제외)
   * - ARPU = MRR / 유료 구독자 수, ARR = MRR × 12
   * - flows: 최근 30일 신규 MRR 유입 · 취소 MRR 손실 · 예약 다운그레이드 소실 예정
   */
  async getStats() {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, activeCount, trialing, past_due, canceled, expired, byPlan, activeSubs, canceledSubs, plans] =
      await Promise.all([
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
        prisma.subscription.findMany({
          where: { status: 'active' },
          select: {
            id: true,
            plan_id: true,
            billing_cycle: true,
            current_period_start: true,
            metadata: true,
            plan: {
              select: { id: true, name: true, display_name: true, price_monthly: true, price_yearly: true },
            },
          },
        }),
        prisma.subscription.findMany({
          where: { status: 'canceled', canceled_at: { gte: monthAgo, not: null } },
          select: {
            id: true,
            billing_cycle: true,
            canceled_at: true,
            plan: {
              select: { id: true, name: true, display_name: true, price_monthly: true, price_yearly: true },
            },
          },
        }),
        prisma.plan.findMany({
          select: { id: true, name: true, display_name: true, price_monthly: true, price_yearly: true },
        }),
      ]);

    // 플랜별 이름 매핑
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));

    // MRR 집계 (active만)
    let mrr = 0;
    let payingSubscribers = 0;
    let newMrr = 0;
    let newSubscriptions = 0;
    let scheduledContraction = 0;
    let scheduledContractions = 0;
    const planMrr = new Map();

    for (const sub of activeSubs) {
      const amount = this._monthlyAmount(sub);
      mrr += amount;
      if (amount > 0) payingSubscribers += 1;
      planMrr.set(sub.plan_id, (planMrr.get(sub.plan_id) || 0) + amount);

      // 최근 30일 내 신규 시작(신규/재활성) 구독 → MRR 유입
      if (sub.current_period_start && sub.current_period_start >= monthAgo) {
        newMrr += amount;
        newSubscriptions += 1;
      }

      // 기간 만료 시 적용 예약된 다운그레이드 → 소실 예정 MRR
      const pending = sub.metadata?.pending_plan_change;
      if (pending?.plan_id) {
        const nextPlan = planMap[pending.plan_id];
        if (nextPlan) {
          const delta = amount - this._monthlyAmount({ billing_cycle: sub.billing_cycle, plan: nextPlan });
          if (delta > 0) {
            scheduledContraction += delta;
            scheduledContractions += 1;
          }
        }
      }
    }

    // 최근 30일 취소로 소실된 MRR
    let canceledMrr = 0;
    for (const sub of canceledSubs) {
      canceledMrr += this._monthlyAmount(sub);
    }

    const byPlanMapped = byPlan.map((bp) => ({
      plan_id: bp.plan_id,
      plan_name: planMap[bp.plan_id]?.name,
      display_name: planMap[bp.plan_id]?.display_name,
      count: bp._count.plan_id,
      mrr: planMrr.get(bp.plan_id) || 0,
    }));

    return {
      total,
      active: activeCount,
      trialing,
      past_due,
      canceled,
      expired,
      mrr: {
        total: Math.round(mrr),
        arr: Math.round(mrr * 12),
        arpu: payingSubscribers > 0 ? Math.round(mrr / payingSubscribers) : 0,
        paying_subscribers: payingSubscribers,
      },
      by_plan: byPlanMapped,
      flows: {
        new_mrr: Math.round(newMrr),
        new_subscriptions: newSubscriptions,
        canceled_mrr: Math.round(canceledMrr),
        canceled_subscriptions: canceledSubs.length,
        net_mrr: Math.round(newMrr - canceledMrr),
        scheduled_contraction_mrr: Math.round(scheduledContraction),
        scheduled_contractions: scheduledContractions,
      },
    };
  }
}

module.exports = new SubscriptionService();

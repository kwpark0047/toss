jest.mock('../../../repositories/Subscription', () => ({
  findByStoreId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  renewSubscription: jest.fn(),
  cancel: jest.fn(),
  findPastDue: jest.fn(),
  findTrialEndingSoon: jest.fn(),
  findExpiringSoon: jest.fn(),
}));

jest.mock('../../../repositories/Plan', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../config/prisma', () => ({
  stores: { update: jest.fn() },
  store_subscriptions: { upsert: jest.fn() },
  subscription: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  plan: { findMany: jest.fn() },
}));

const SubscriptionRepository = require('../../../repositories/Subscription');
const PlanRepository = require('../../../repositories/Plan');
const prisma = require('../../../config/prisma');
const service = require('../../../services/SubscriptionService');

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createSubscription', () => {
    test('플랜 없으면 404', async () => {
      PlanRepository.findById.mockResolvedValue(null);
      await expect(service.createSubscription(1, 99)).rejects.toThrow('플랜을 찾을 수 없습니다');
    });

    test('무료체험 기간 없이 생성', async () => {
      PlanRepository.findById.mockResolvedValue({ id: 2, name: 'pro', price_monthly: 30000 });
      SubscriptionRepository.create.mockResolvedValue({ id: 5, status: 'active' });

      const result = await service.createSubscription(1, 2, 'MONTHLY', 'pm_1', 0);

      expect(result.status).toBe('active');
      expect(SubscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 1, plan_id: 2, status: 'active' })
      );
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { plan: 'pro' },
      });
      expect(prisma.store_subscriptions.upsert).toHaveBeenCalledWith({
        where: { store_id: 1 },
        create: expect.objectContaining({ plan: 'pro', subscription_id: 5 }),
        update: expect.objectContaining({ plan: 'pro', subscription_id: 5 }),
      });
    });

    test('체험판 기간 있으면 trialing', async () => {
      PlanRepository.findById.mockResolvedValue({ id: 2, name: 'pro' });
      SubscriptionRepository.create.mockResolvedValue({ id: 6, status: 'trialing' });

      const result = await service.createSubscription(1, 2, 'MONTHLY', null, 7);
      expect(result.status).toBe('trialing');
      expect(SubscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ trial_ends_at: expect.any(Date) })
      );
    });
  });

  describe('getSubscription / getSubscriptionById', () => {
    test('getSubscription 위임', async () => {
      SubscriptionRepository.findByStoreId.mockResolvedValue({ id: 1 });
      expect(await service.getSubscription(1)).toEqual({ id: 1 });
    });

    test('getSubscriptionById 위임', async () => {
      SubscriptionRepository.findById.mockResolvedValue({ id: 2 });
      expect(await service.getSubscriptionById(2)).toEqual({ id: 2 });
    });
  });

  describe('renewSubscription', () => {
    test('구독 없으면 404', async () => {
      SubscriptionRepository.findById.mockResolvedValue(null);
      await expect(service.renewSubscription(99)).rejects.toThrow('구독을 찾을 수 없습니다');
    });

    test('갱신 + stores 업데이트', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        plan_id: 2,
        store_id: 3,
        billing_cycle: 'MONTHLY',
        current_period_end: past,
        payment_method_id: 'pm_old',
      });
      PlanRepository.findById.mockResolvedValue({ name: 'pro' });
      SubscriptionRepository.renewSubscription.mockResolvedValue({ id: 1, status: 'active' });

      const result = await service.renewSubscription(1, 'pm_new');
      expect(result.id).toBe(1);
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { plan: 'pro' },
      });
      expect(prisma.store_subscriptions.upsert).toHaveBeenCalledWith({
        where: { store_id: 3 },
        create: expect.objectContaining({ plan: 'pro', payment_method_id: 'pm_new' }),
        update: expect.objectContaining({ plan: 'pro', payment_method_id: 'pm_new' }),
      });
    });
  });

  describe('cancelSubscription', () => {
    test('구독 없으면 404', async () => {
      SubscriptionRepository.findById.mockResolvedValue(null);
      await expect(service.cancelSubscription(99)).rejects.toThrow('구독을 찾을 수 없습니다');
    });

    test('기간 만료 시점 취소', async () => {
      const periodEnd = new Date('2026-12-31');
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        store_id: 2,
        current_period_end: periodEnd,
      });
      SubscriptionRepository.cancel.mockResolvedValue({ id: 1, status: 'canceled' });

      const result = await service.cancelSubscription(1, true);
      expect(result.status).toBe('canceled');
      expect(SubscriptionRepository.cancel).toHaveBeenCalledWith(1, periodEnd);
      expect(prisma.stores.update).not.toHaveBeenCalled();
      expect(prisma.store_subscriptions.upsert).toHaveBeenCalledWith({
        where: { store_id: 2 },
        create: expect.objectContaining({ auto_renew: false, plan_expires_at: periodEnd }),
        update: expect.objectContaining({ auto_renew: false, plan_expires_at: periodEnd }),
      });
    });

    test('즉시 취소', async () => {
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        store_id: 2,
        current_period_end: new Date('2026-12-31'),
      });
      SubscriptionRepository.cancel.mockResolvedValue({ id: 1 });

      await service.cancelSubscription(1, false);
      expect(SubscriptionRepository.cancel).toHaveBeenCalledWith(1, expect.any(Date));
    });
  });

  describe('changePlan', () => {
    test('구독 없으면 404', async () => {
      SubscriptionRepository.findById.mockResolvedValue(null);
      await expect(service.changePlan(99, 1)).rejects.toThrow('구독을 찾을 수 없습니다');
    });

    test('새 플랜 없으면 404', async () => {
      SubscriptionRepository.findById.mockResolvedValue({ id: 1 });
      PlanRepository.findById.mockResolvedValue(null);
      await expect(service.changePlan(1, 99)).rejects.toThrow('플랜을 찾을 수 없습니다');
    });

    test('업그레이드는 즉시 적용', async () => {
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        plan_id: 2,
        store_id: 3,
        billing_cycle: 'MONTHLY',
        plan: { id: 2, name: 'pro', price_monthly: 10000 },
        metadata: {},
      });
      PlanRepository.findById.mockResolvedValue({
        id: 4,
        name: 'enterprise',
        price_monthly: 100000,
      });
      SubscriptionRepository.update.mockResolvedValue({ id: 1 });

      await service.changePlan(1, 4, true);
      expect(SubscriptionRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ plan_id: 4, status: 'active' })
      );
    });

    test('다운그레이드는 기간 만료 시 예약', async () => {
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        plan_id: 4,
        store_id: 3,
        billing_cycle: 'MONTHLY',
        plan: { id: 4, name: 'enterprise', price_monthly: 100000 },
        metadata: {},
        current_period_end: new Date('2026-12-31'),
      });
      PlanRepository.findById.mockResolvedValue({ id: 2, name: 'pro', price_monthly: 10000 });
      SubscriptionRepository.update.mockResolvedValue({ id: 1 });

      await service.changePlan(1, 2, true);
      expect(SubscriptionRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          metadata: expect.objectContaining({ pending_plan_change: expect.any(Object) }),
        })
      );
    });

    test('prorate false 시 다운그레이드도 즉시 적용', async () => {
      SubscriptionRepository.findById.mockResolvedValue({
        id: 1,
        plan_id: 4,
        store_id: 3,
        billing_cycle: 'MONTHLY',
        plan: { id: 4, name: 'enterprise', price_monthly: 100000 },
        metadata: {},
      });
      PlanRepository.findById.mockResolvedValue({ id: 2, name: 'pro', price_monthly: 10000 });
      SubscriptionRepository.update.mockResolvedValue({ id: 1 });

      await service.changePlan(1, 2, false);
      expect(SubscriptionRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ plan_id: 2, status: 'active' })
      );
    });
  });

  describe('updatePaymentMethod', () => {
    test('구독 없으면 404', async () => {
      SubscriptionRepository.findById.mockResolvedValue(null);
      await expect(service.updatePaymentMethod(99, 'bk_1')).rejects.toThrow(
        '구독을 찾을 수 없습니다'
      );
    });

    test('결제 수단 업데이트', async () => {
      SubscriptionRepository.findById.mockResolvedValue({ id: 1, store_id: 2 });
      SubscriptionRepository.update.mockResolvedValue({ id: 1 });

      const result = await service.updatePaymentMethod(1, 'bk_new');
      expect(result.id).toBe(1);
      expect(SubscriptionRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ payment_method_id: 'bk_new' })
      );
    });
  });

  describe('processOverdueSubscriptions', () => {
    test('7일 이상 연체면 정지', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      SubscriptionRepository.findPastDue.mockResolvedValue([
        { id: 1, store_id: 2, current_period_end: oldDate },
      ]);

      await service.processOverdueSubscriptions();
      expect(SubscriptionRepository.updateStatus).toHaveBeenCalledWith(1, 'past_due');
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { plan: 'free' },
      });
      expect(prisma.store_subscriptions.upsert).toHaveBeenCalledWith({
        where: { store_id: 2 },
        create: expect.objectContaining({ plan: 'free', auto_renew: false }),
        update: expect.objectContaining({ plan: 'free', auto_renew: false }),
      });
    });

    test('7일 미만 연체면 상태 표시만', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      SubscriptionRepository.findPastDue.mockResolvedValue([
        { id: 1, store_id: 2, current_period_end: recentDate },
      ]);

      await service.processOverdueSubscriptions();
      expect(SubscriptionRepository.updateStatus).toHaveBeenCalledWith(1, 'past_due');
      expect(prisma.stores.update).not.toHaveBeenCalled();
      expect(prisma.store_subscriptions.upsert).not.toHaveBeenCalled();
    });

    test('개별 실패는 흡수', async () => {
      SubscriptionRepository.findPastDue.mockResolvedValue([
        { id: 1, store_id: 2, current_period_end: new Date(Date.now() - 1000000) },
      ]);
      SubscriptionRepository.updateStatus.mockRejectedValue(new Error('boom'));

      await expect(service.processOverdueSubscriptions()).resolves.toBeUndefined();
    });
  });

  describe('알림 배치', () => {
    test('notifyTrialEnding', async () => {
      SubscriptionRepository.findTrialEndingSoon.mockResolvedValue([{ id: 1 }]);
      expect(await service.notifyTrialEnding()).toEqual([{ id: 1 }]);
    });

    test('notifyExpiringSoon', async () => {
      SubscriptionRepository.findExpiringSoon.mockResolvedValue([{ id: 2 }]);
      expect(await service.notifyExpiringSoon()).toEqual([{ id: 2 }]);
    });
  });

  describe('getStats', () => {
    test('구독 통계 집계 (counts + MRR + flows)', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      prisma.subscription.groupBy.mockResolvedValue([{ plan_id: 1, _count: { plan_id: 3 } }]);
      prisma.subscription.findMany
        .mockResolvedValueOnce([
          {
            plan_id: 1,
            billing_cycle: 'MONTHLY',
            current_period_start: new Date(),
            metadata: {},
            plan: { id: 1, name: 'pro', display_name: '프로', price_monthly: 10000, price_yearly: 0 },
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.plan.findMany.mockResolvedValue([
        { id: 1, name: 'pro', display_name: '프로', price_monthly: 10000, price_yearly: 0 },
      ]);

      const stats = await service.getStats();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(5);
      expect(stats.trialing).toBe(2);
      expect(stats.mrr).toEqual({
        total: 10000,
        arr: 120000,
        arpu: 10000,
        paying_subscribers: 1,
      });
      expect(stats.by_plan).toEqual([
        { plan_id: 1, plan_name: 'pro', display_name: '프로', count: 3, mrr: 10000 },
      ]);
      expect(stats.flows).toMatchObject({
        new_mrr: 10000,
        new_subscriptions: 1,
        canceled_mrr: 0,
        canceled_subscriptions: 0,
        net_mrr: 10000,
        scheduled_contraction_mrr: 0,
        scheduled_contractions: 0,
      });
    });
  });

  describe('getStats - MRR 지표', () => {
    const now = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const countChain = (values) => {
      prisma.subscription.count
        .mockResolvedValueOnce(values.total)
        .mockResolvedValueOnce(values.active)
        .mockResolvedValueOnce(values.trialing)
        .mockResolvedValueOnce(values.past_due)
        .mockResolvedValueOnce(values.canceled)
        .mockResolvedValueOnce(values.expired);
    };

    test('active MONTHLY/YEARLY 혼합하여 MRR·ARR·ARPU 집계', async () => {
      const plans = [
        { id: 'p_pro', name: 'pro', display_name: '프로', price_monthly: 10000, price_yearly: 0 },
        { id: 'p_ent', name: 'enterprise', display_name: '엔터프라이즈', price_monthly: 0, price_yearly: 240000 },
      ];
      const activeSubs = [
        {
          plan_id: 'p_pro',
          billing_cycle: 'MONTHLY',
          current_period_start: now,
          metadata: {},
          plan: plans[0],
        },
        {
          plan_id: 'p_ent',
          billing_cycle: 'YEARLY',
          current_period_start: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          metadata: {},
          plan: plans[1],
        },
      ];

      countChain({ total: 5, active: 2, trialing: 1, past_due: 1, canceled: 1, expired: 0 });
      prisma.subscription.groupBy.mockResolvedValue([
        { plan_id: 'p_pro', _count: { plan_id: 1 } },
        { plan_id: 'p_ent', _count: { plan_id: 1 } },
      ]);
      prisma.subscription.findMany.mockResolvedValueOnce(activeSubs).mockResolvedValueOnce([]);
      prisma.plan.findMany.mockResolvedValue(plans);

      const stats = await service.getStats();
      // pro 10,000 + enterprise 240,000/12 = 20,000
      expect(stats.mrr.total).toBe(30000);
      expect(stats.mrr.arr).toBe(360000);
      expect(stats.mrr.arpu).toBe(15000);
      expect(stats.mrr.paying_subscribers).toBe(2);
      expect(stats.by_plan).toEqual([
        expect.objectContaining({ plan_id: 'p_pro', count: 1, mrr: 10000 }),
        expect.objectContaining({ plan_id: 'p_ent', count: 1, mrr: 20000 }),
      ]);
    });

    test('무료 플랜(단가 0)은 paying_subscribers에서 제외되고 MRR 0', async () => {
      const freePlan = { id: 'p_free', name: 'free', display_name: '무료', price_monthly: 0, price_yearly: 0 };
      prisma.subscription.findMany
        .mockResolvedValueOnce([
          {
            plan_id: 'p_free',
            billing_cycle: 'MONTHLY',
            current_period_start: now,
            metadata: {},
            plan: freePlan,
          },
        ])
        .mockResolvedValueOnce([]);
      countChain({ total: 2, active: 1, trialing: 0, past_due: 0, canceled: 1, expired: 0 });
      prisma.subscription.groupBy.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue([freePlan]);

      const stats = await service.getStats();
      expect(stats.mrr.total).toBe(0);
      expect(stats.mrr.arpu).toBe(0);
      expect(stats.mrr.paying_subscribers).toBe(0);
    });

    test('flows: 30일 신규 유입 · 취소 손실 · 예약 다운그레이드 소실 집계', async () => {
      const plans = [
        { id: 'p_pro', name: 'pro', display_name: '프로', price_monthly: 10000, price_yearly: 0 },
        { id: 'p_ent', name: 'enterprise', display_name: '엔터프라이즈', price_monthly: 100000, price_yearly: 0 },
      ];
      const activeSubs = [
        // 30일 내 신규 시작 → MRR 유입
        {
          plan_id: 'p_pro',
          billing_cycle: 'MONTHLY',
          current_period_start: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          metadata: {},
          plan: plans[0],
        },
        // 기간 만료 시 다운그레이드 예약 → 소실 예정 MRR 100,000 - 10,000
        {
          plan_id: 'p_ent',
          billing_cycle: 'MONTHLY',
          current_period_start: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          metadata: { pending_plan_change: { plan_id: 'p_pro' } },
          plan: plans[1],
        },
      ];
      const canceledSubs = [
        {
          billing_cycle: 'MONTHLY',
          canceled_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          plan: plans[1],
        },
      ];

      countChain({ total: 3, active: 2, trialing: 0, past_due: 0, canceled: 1, expired: 0 });
      prisma.subscription.groupBy.mockResolvedValue([]);
      prisma.subscription.findMany.mockResolvedValueOnce(activeSubs).mockResolvedValueOnce(canceledSubs);
      prisma.plan.findMany.mockResolvedValue(plans);

      const stats = await service.getStats();
      expect(stats.mrr.total).toBe(110000);
      expect(stats.flows).toEqual({
        new_mrr: 10000,
        new_subscriptions: 1,
        canceled_mrr: 100000,
        canceled_subscriptions: 1,
        net_mrr: -90000,
        scheduled_contraction_mrr: 90000,
        scheduled_contractions: 1,
      });
    });

    test('YEARLY 구독의 예약 다운그레이드 소실도 월등가 기준으로 산출', async () => {
      const plans = [
        { id: 'p_ent', name: 'enterprise', display_name: '엔터프라이즈', price_monthly: 0, price_yearly: 240000 },
        { id: 'p_pro', name: 'pro', display_name: '프로', price_monthly: 10000, price_yearly: 0 },
      ];
      prisma.subscription.findMany
        .mockResolvedValueOnce([
          {
            plan_id: 'p_ent',
            billing_cycle: 'YEARLY',
            current_period_start: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000),
            metadata: { pending_plan_change: { plan_id: 'p_pro' } },
            plan: plans[0],
          },
        ])
        .mockResolvedValueOnce([]);
      countChain({ total: 1, active: 1, trialing: 0, past_due: 0, canceled: 0, expired: 0 });
      prisma.subscription.groupBy.mockResolvedValue([]);
      prisma.plan.findMany.mockResolvedValue(plans);

      const stats = await service.getStats();
      // 240,000/12=20,000 → pro 10,000 (월등가 delta)
      expect(stats.mrr.total).toBe(20000);
      expect(stats.flows.scheduled_contraction_mrr).toBe(10000);
      expect(stats.flows.scheduled_contractions).toBe(1);
    });
  });
});

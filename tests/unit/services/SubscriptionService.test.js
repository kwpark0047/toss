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
  subscription: { count: jest.fn(), groupBy: jest.fn() },
  plan: { findMany: jest.fn() },
}));

const SubscriptionRepository = require('../../../repositories/Subscription');
const PlanRepository = require('../../../repositories/Plan');
const prisma = require('../../../config/prisma');
const service = require('../../../services/SubscriptionService');

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        data: expect.objectContaining({ plan: 'pro', subscription_id: 5 }),
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
        data: expect.objectContaining({ plan: 'pro', payment_method_id: 'pm_new' }),
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
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: expect.objectContaining({ auto_renew: false }),
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
        data: expect.objectContaining({ plan: 'free' }),
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
    test('구독 통계 집계', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      prisma.subscription.groupBy.mockResolvedValue([{ plan_id: 1, _count: { plan_id: 3 } }]);
      prisma.plan.findMany.mockResolvedValue([{ id: 1, name: 'pro', display_name: '프로' }]);

      const stats = await service.getStats();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(5);
      expect(stats.by_plan).toEqual([
        { plan_id: 1, plan_name: 'pro', display_name: '프로', count: 3 },
      ]);
    });
  });
});

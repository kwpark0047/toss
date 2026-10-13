jest.mock('../../../config/prisma', () => ({
  $queryRaw: jest.fn(),
  subscription: { groupBy: jest.fn() },
  plan: { findMany: jest.fn() },
}));
const db = require('../../../config/prisma');
const service = require('../../../services/SubscriptionService');
test('grouped quantities preserve paid counts, renewals, annual rounding and contractions', async () => {
  db.$queryRaw
    .mockResolvedValueOnce([
      { total: 8n, active: 6n, trialing: 0n, past_due: 0n, canceled: 2n, expired: 0n },
    ])
    .mockResolvedValueOnce([
      {
        plan_id: 'pro',
        billing_cycle: 'YEARLY',
        recent: true,
        pending_plan_id: 'free',
        subscription_count: 3n,
      },
      { plan_id: 'free', billing_cycle: 'MONTHLY', recent: true, subscription_count: 3n },
    ])
    .mockResolvedValueOnce([{ plan_id: 'pro', billing_cycle: 'MONTHLY', subscription_count: 2n }]);
  db.subscription.groupBy.mockResolvedValue([
    { plan_id: 'pro', _count: { plan_id: 5 } },
    { plan_id: 'free', _count: { plan_id: 3 } },
  ]);
  db.plan.findMany.mockResolvedValue([
    { id: 'pro', price_monthly: 10000, price_yearly: 100001 },
    { id: 'free', price_monthly: 0, price_yearly: 0 },
  ]);
  const result = await service.getStats();
  expect(result.mrr).toMatchObject({ total: 24999, paying_subscribers: 3, arpu: 8333 });
  expect(result.flows).toMatchObject({
    new_subscriptions: 6,
    new_mrr: 24999,
    canceled_subscriptions: 2,
    canceled_mrr: 20000,
    scheduled_contractions: 3,
    scheduled_contraction_mrr: 24999,
  });
});

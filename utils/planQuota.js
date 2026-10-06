const { AppError } = require('./errorHandler');
const { effectivePlan } = require('./subscriptionPolicy');
const { PLAN_FEATURES } = require('../middleware/planFeatures');
const aliases = { maxMenus: 'menuItems', maxStaff: 'staff', ordersPerMonth: 'ordersPerMonth' };
function planLimit(subscription, key) {
  const name = effectivePlan(subscription);
  const config = name === subscription?.plan?.name ? subscription.plan.limits : null;
  const override = config?.[key] ?? config?.[aliases[key]];
  if (Number.isSafeInteger(override) && (override === -1 || override >= 0)) return override;
  return PLAN_FEATURES[key]?.[name] ?? 0;
}
async function assertPlanQuota(tx, storeId, key) {
  const id = Number(storeId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('유효한 매장 ID가 필요합니다.', 400);
  // Serialize quota checks and creation for the same tenant, inside its write transaction.
  await tx.$queryRaw`SELECT id FROM public.stores WHERE id = ${id} FOR UPDATE`;
  const sub = await tx.subscription.findUnique({
    where: { store_id: id },
    include: { plan: true },
  });
  const limit = planLimit(sub, key);
  if (limit === -1) return;
  let usage;
  if (key === 'maxMenus') usage = await tx.products.count({ where: { store_id: id } });
  else if (key === 'maxStaff')
    usage = await tx.staff.count({ where: { store_id: id, is_active: 1 } });
  else if (key === 'ordersPerMonth') {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    usage = await tx.orders.count({ where: { store_id: id, created_at: { gte: start } } });
  } else throw new AppError('사용량 제한 정의가 없습니다.', 500);
  if (usage >= limit)
    throw new AppError(
      '현재 요금제의 사용량 한도에 도달했습니다. 구독 요금제를 확인해 주세요.',
      403,
      'PLAN_LIMIT_REACHED',
      { resource: key, limit, usage }
    );
}
module.exports = { assertPlanQuota, planLimit };

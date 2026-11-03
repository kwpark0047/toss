function nextBillingPeriod(from, cycle) {
  if (!['MONTHLY', 'YEARLY'].includes(cycle)) throw new Error('Invalid billing cycle');
  const date = new Date(from);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid billing date');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (cycle === 'YEARLY' ? 12 : 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}
function effectivePlan(subscription, now = new Date()) {
  if (subscription?.plan?.is_active === false) return 'free';
  if (!subscription || !['active', 'trialing'].includes(subscription.status)) return 'free';
  const end =
    subscription.status === 'trialing'
      ? subscription.trial_ends_at
      : subscription.current_period_end;
  const expiry = new Date(end || 0);
  if (!Number.isFinite(expiry.getTime()) || expiry <= now) return 'free';
  if (subscription.cancel_at && new Date(subscription.cancel_at) <= now) return 'free';
  return subscription.plan?.name || 'free';
}
// 신규 가입 계정은 trial_ends_at까지 이 유료 플랜의 기능을 무료로 쓴다.
// 체험이 끝나면 별도 조치 없이 무료(free) 플랜으로 돌아간다.
const TRIAL_PLAN = 'pro';

function isTrialActive(trialEndsAt, now = new Date()) {
  if (!trialEndsAt) return false;
  const end = new Date(trialEndsAt);
  return Number.isFinite(end.getTime()) && end > now;
}

// 결제된 구독이 우선이고, 결제 플랜이 없을 때만 체험 플랜을 적용한다.
function resolvePlan(subscription, trialEndsAt, now = new Date()) {
  const paid = effectivePlan(subscription, now);
  if (paid !== 'free') return paid;
  return isTrialActive(trialEndsAt, now) ? TRIAL_PLAN : 'free';
}

// 매장 소유자의 체험 종료 시각. prisma 클라이언트와 트랜잭션(tx) 모두에서 동작한다.
async function ownerTrialEndsAt(db, storeId) {
  const id = Number(storeId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const rows = await db.$queryRaw`
    SELECT u.trial_ends_at FROM public.stores s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.id = ${id} AND u.auth_status = 'active'
      AND u.business_access_status IN ('trialing', 'approved')
    LIMIT 1`;
  return Array.isArray(rows) && rows[0] ? rows[0].trial_ends_at : null;
}

module.exports = {
  nextBillingPeriod,
  effectivePlan,
  TRIAL_PLAN,
  isTrialActive,
  resolvePlan,
  ownerTrialEndsAt,
};

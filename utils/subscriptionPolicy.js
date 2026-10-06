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
module.exports = { nextBillingPeriod, effectivePlan };

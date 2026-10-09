const logger = require('../utils/logger');
function startBillingScheduler() {
  if (process.env.BILLING_SCHEDULER_ENABLED !== 'true' || process.env.NODE_ENV === 'test')
    return () => {};
  let active = null;
  let stopped = false;
  const tick = () => {
    if (stopped || active) return Promise.resolve();
    active = (async () => {
      try {
        await require('./SaaSBillingService').runDueBilling();
      } catch (error) {
        logger.error('Billing scheduler failed', { error: error.message });
      } finally {
        active = null;
      }
    })();
    return active;
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  // Deliberately do not charge during server bootstrap.
  return () => {
    stopped = true;
    clearInterval(timer);
    return active || Promise.resolve();
  };
}
module.exports = { startBillingScheduler };

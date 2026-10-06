const logger = require('../utils/logger');
function startBillingScheduler() {
  if (process.env.BILLING_SCHEDULER_ENABLED !== 'true' || process.env.NODE_ENV === 'test')
    return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await require('./SaaSBillingService').runDueBilling();
    } catch (error) {
      logger.error('Billing scheduler failed', { error: error.message });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  // Deliberately do not charge during server bootstrap.
  return () => clearInterval(timer);
}
module.exports = { startBillingScheduler };

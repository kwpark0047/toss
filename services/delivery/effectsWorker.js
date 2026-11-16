// The inbox is durable; poll at startup and periodically so a restart does not
// depend on the provider sending the same webhook again. Leases fence replicas.
function start({ service, orderService, enabled = process.env.NODE_ENV !== 'test', intervalMs = 30000 } = {}) {
  if (!enabled) return async () => {};
  const logger = require('../../utils/logger');
  let stopped = false;
  let running = null;
  const tick = () => {
    if (stopped || running) return running;
    running = Promise.resolve().then(() => service.recoverPendingEffects(orderService))
      .catch(() => logger.warn('[DeliveryDispatch] Recovery scan unavailable; will retry'))
      .finally(() => { running = null; });
    return running;
  };
  const first = setTimeout(tick, 0);
  const timer = setInterval(tick, intervalMs);
  first.unref?.();
  timer.unref?.();
  return async () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(timer);
    await running;
  };
}
module.exports = { start };

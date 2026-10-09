// Deploy independently from the HTTP service. Both financial and outbound jobs are opt-in.
require('dotenv').config();
const { startBillingScheduler } = require('../services/billingScheduler');
const { startRetryScheduler } = require('../services/webhookDispatcher');
const prismaModule = require('../config/prisma');
const prisma = typeof prismaModule.disconnectAll === 'function' ? prismaModule : prismaModule.default;
const billingEnabled = process.env.BILLING_SCHEDULER_ENABLED === 'true';
const webhookEnabled = process.env.WEBHOOK_RETRY_ENABLED === 'true';
const paymentInboxEnabled = process.env.PAYMENT_INBOX_RETRY_ENABLED === 'true';
if (!billingEnabled && !webhookEnabled && !paymentInboxEnabled) {
  console.error('Configure BILLING_SCHEDULER_ENABLED, WEBHOOK_RETRY_ENABLED or PAYMENT_INBOX_RETRY_ENABLED explicitly before starting this worker.');
  process.exitCode = 2;
} else {
  const stopBilling = billingEnabled ? startBillingScheduler() : () => {};
  const stopWebhook = webhookEnabled ? startRetryScheduler() : () => {};
  let inboxActive = null;
  let stopping = false;
  const inboxTimer = paymentInboxEnabled ? setInterval(() => {
    if (stopping || inboxActive) return;
    inboxActive = (async () => {
    try { await require('../services/PaymentWebhookInbox').resume(null,20); }
    catch { console.error('PAYMENT_INBOX_RETRY_FAILED'); }
    finally { inboxActive = null; }
    })();
  },30000) : null;
  // Scheduler timers are unref'ed for API shutdown; the worker needs its own lifecycle.
  const heartbeat = setInterval(() => {}, 30000);
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const drains = [stopBilling(), stopWebhook(), inboxActive];
    clearInterval(heartbeat);
    if(inboxTimer) clearInterval(inboxTimer);
    // Never close DB under an active PG outcome. On deadline the durable lease
    // remains available for reconciliation after restart; do not claim success.
    const deadline = setTimeout(() => { console.error('WORKER_DRAIN_TIMEOUT'); process.exit(1); }, 25000);
    try {
      await Promise.all(drains);
      await require('../utils/runtimeResources').closeRuntimeResources();
      await prisma.disconnectAll();
    }
    finally { clearTimeout(deadline); }
  };
  process.once('SIGTERM', () => { void stop(); });
  process.once('SIGINT', () => { void stop(); });
}

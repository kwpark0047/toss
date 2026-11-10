const crypto = require('node:crypto');
const webPush = require('web-push');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

function config() {
  const { WEB_PUSH_PUBLIC_KEY: publicKey, WEB_PUSH_PRIVATE_KEY: privateKey } = process.env;
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}
function validateSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  try {
    const url = new URL(value.endpoint);
    const host = url.hostname;
    const allowed =
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(
        host
      ) ||
      (host.endsWith('.notify.windows.com') && host !== 'notify.windows.com');
    return (
      allowed &&
      url.protocol === 'https:' &&
      (!url.port || url.port === '443') &&
      !url.username &&
      !url.password &&
      !url.hash &&
      /^[A-Za-z0-9_-]{87}={0,2}$/.test(value.keys?.p256dh || '') &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(value.keys?.auth || '')
    );
  } catch {
    return false;
  }
}
const endpointHash = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');
function key() {
  return crypto.createHash('sha256').update(`order-web-push:${config().privateKey}`).digest();
}
function encrypt(value) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key(), iv, { authTagLength: 16 });
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function decrypt(value) {
  const bytes = Buffer.from(value, 'base64'),
    cipher = crypto.createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12), { authTagLength: 16 });
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
async function subscribe(orderId, subscription) {
  if (!config()) {
    const error = new Error('푸시 알림을 준비 중이에요.');
    error.status = 503;
    throw error;
  }
  if (!validateSubscription(subscription)) {
    const error = new Error('유효하지 않은 푸시 구독입니다.');
    error.status = 400;
    throw error;
  }
  const hash = endpointHash(subscription.endpoint);
  // Re-enabling must preserve sent_at: one ready alert per order and device.
  const data = {
    encrypted_payload: encrypt({ endpoint: subscription.endpoint, keys: subscription.keys }),
    enabled: true,
    expires_at: new Date(Date.now() + 86400000),
    next_attempt_at: new Date(),
    last_error: null,
  };
  await prisma.order_push_subscriptions.upsert({
    where: { order_id_endpoint_hash: { order_id: orderId, endpoint_hash: hash } },
    create: { order_id: orderId, endpoint_hash: hash, ...data },
    update: data,
  });
}
async function unsubscribe(orderId, endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return;
  await prisma.order_push_subscriptions.deleteMany({
    where: { order_id: orderId, endpoint_hash: endpointHash(endpoint) },
  });
}
let busy = false;
async function deliverPending() {
  if (busy || !config()) return;
  busy = true;
  try {
    const now = new Date();
    await prisma.order_push_subscriptions.deleteMany({ where: { expires_at: { lt: now } } });
    const eligible = {
      enabled: true,
      sent_at: null,
      attempts: { lt: 6 },
      expires_at: { gt: now },
      next_attempt_at: { lte: now },
      OR: [{ locked_until: null }, { locked_until: { lt: now } }],
      orders: { status: 'ready' },
    };
    const rows = await prisma.order_push_subscriptions.findMany({
      where: eligible,
      take: 20,
      orderBy: { next_attempt_at: 'asc' },
    });
    for (let offset = 0; offset < rows.length; offset += 5)
      await Promise.all(
        rows.slice(offset, offset + 5).map(async (row) => {
          const claimed = await prisma.order_push_subscriptions.updateMany({
            where: { id: row.id, ...eligible },
            data: { locked_until: new Date(Date.now() + 60000), attempts: { increment: 1 } },
          });
          if (!claimed.count) return;
          try {
            const payload = JSON.stringify({ type: 'ORDER_READY', orderId: row.order_id });
            await webPush.sendNotification(decrypt(row.encrypted_payload), payload, {
              TTL: 3600,
              urgency: 'high',
              timeout: 10000,
              topic: endpointHash(`order-ready-${row.order_id}`).slice(0, 32),
              vapidDetails: {
                subject: process.env.WEB_PUSH_SUBJECT || 'https://wemarket-saas.vercel.app',
                ...config(),
              },
            });
            await prisma.order_push_subscriptions.updateMany({
              where: { id: row.id },
              data: { sent_at: new Date(), locked_until: null, last_error: null },
            });
          } catch (error) {
            const code = Number(error.statusCode) || 0;
            const permanent =
              [400, 401, 403, 404, 410].includes(code) ||
              (!code && error.code === 'ERR_OSSL_BAD_DECRYPT');
            await prisma.order_push_subscriptions.updateMany({
              where: { id: row.id },
              data: {
                locked_until: null,
                enabled: !permanent,
                last_error: code ? String(code) : 'DELIVERY_FAILED',
                next_attempt_at: new Date(Date.now() + Math.min(300000, 10000 * 2 ** row.attempts)),
              },
            });
            // Never log endpoints, key material, provider response bodies, or customer identifiers.
            logger.warn('[OrderWebPush] delivery deferred', { status: code || 'network' });
          }
        })
      );
  } finally {
    busy = false;
  }
}
function start() {
  if (process.env.NODE_ENV === 'test' || !config()) return () => {};
  const tick = () => deliverPending().catch(() => logger.warn('[OrderWebPush] queue unavailable'));
  const timer = setInterval(tick, 10000);
  timer.unref();
  void tick();
  return async () => {
    clearInterval(timer);
    while (busy) await new Promise((resolve) => setTimeout(resolve, 50));
  };
}
module.exports = {
  config,
  validateSubscription,
  endpointHash,
  subscribe,
  unsubscribe,
  deliverPending,
  start,
};

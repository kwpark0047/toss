const crypto = require('node:crypto');
const prisma = require('../config/prisma');
const { encryptToken, decryptToken } = require('../utils/tokenEncryption');
const { AppError } = require('../utils/errorHandler');
const fields = [
  'paymentKey',
  'orderId',
  'totalAmount',
  'status',
  'approvedAt',
  'canceledAt',
  'balanceAmount',
  'transactionKey',
  'subscriptionId',
  'cancelReason',
];
function normalize(event) {
  if (
    typeof event?.eventType !== 'string' ||
    event.eventType.length > 100 ||
    !event.data ||
    typeof event.data !== 'object'
  )
    throw new AppError('잘못된 웹훅입니다.', 400);
  const data = Object.fromEntries(
    fields
      .filter((k) => ['string', 'number'].includes(typeof event.data[k]))
      .map((k) => [k, event.data[k]])
  );
  if (
    event.eventType === 'PAYMENT_STATUS_CHANGED' &&
    (typeof data.paymentKey !== 'string' ||
      !data.paymentKey ||
      typeof data.orderId !== 'string' ||
      !data.orderId ||
      !Number.isSafeInteger(data.totalAmount) ||
      data.totalAmount <= 0 ||
      typeof data.status !== 'string')
  )
    throw new AppError('웹훅 결제 정보가 부족합니다.', 400);
  const providerId = event.eventId || event.data.webhookId || event.data.eventId;
  if (providerId && (typeof providerId !== 'string' || providerId.length > 255))
    throw new AppError('잘못된 웹훅 ID입니다.', 400);
  const payload = {
    eventType: event.eventType,
    data,
    ...(providerId ? { eventId: providerId } : {}),
  };
  if (JSON.stringify(payload).length > 16384)
    throw new AppError('웹훅 크기가 초과되었습니다.', 400);
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const id = crypto
    .createHash('sha256')
    .update(`toss:${providerId || digest}`)
    .digest('hex');
  return { id, digest, payload };
}
async function run(event, operation, kind = 'webhook') {
  const normalized = normalize(event),
    now = new Date(),
    owner = crypto.randomUUID();
  // No ACK before durable receipt. No raw customer/PG fields in logs or public results.
  await prisma.paymentWebhookInbox.upsert({
    where: { id: normalized.id },
    create: {
      id: normalized.id,
      kind,
      event_type: normalized.payload.eventType,
      payload_hash: normalized.digest,
      payload_encrypted: encryptToken(JSON.stringify(normalized.payload)),
    },
    update: {},
  });
  const receipt = await prisma.$transaction((tx) =>
    tx.paymentWebhookInbox.findUnique({ where: { id: normalized.id } })
  );
  if (receipt.payload_hash !== normalized.digest || receipt.kind !== kind)
    throw new AppError('웹훅 ID와 내용이 충돌합니다.', 409);
  if (['processed', 'manual_review'].includes(receipt.status))
    return { received: true, duplicated: true, reviewRequired: receipt.status === 'manual_review' };
  if (
    kind === 'auto_cancel' &&
    receipt.status !== 'pending' &&
    Date.now() - new Date(receipt.created_at).getTime() > 86400000
  ) {
    await prisma.paymentWebhookInbox.updateMany({
      where: { id: receipt.id, status: receipt.status },
      data: { status: 'manual_review', error_code: 'OLD_PG_OUTCOME_REQUIRES_RECONCILIATION' },
    });
    return { received: true, reviewRequired: true };
  }
  const claim = await prisma.paymentWebhookInbox.updateMany({
    where: {
      id: receipt.id,
      attempts: { lt: 5 },
      OR: [
        { status: 'pending' },
        { status: 'failed', next_retry_at: { lte: now } },
        { status: 'processing', lease_until: { lt: now } },
      ],
    },
    data: {
      status: 'processing',
      owner,
      lease_until: new Date(now.getTime() + 180000),
      attempts: { increment: 1 },
    },
  });
  if (claim.count !== 1) throw new AppError('웹훅 처리 중 또는 운영 확인이 필요합니다.', 503);
  const owned = { id: receipt.id, status: 'processing', owner };
  try {
    const result = await operation(normalized.payload);
    const stored = await prisma.paymentWebhookInbox.updateMany({
      where: owned,
      data: {
        status: result?.reviewRequired ? 'manual_review' : 'processed',
        result: result || { received: true },
        owner: null,
        lease_until: null,
        error_code: null,
      },
    });
    if (stored.count !== 1) throw new AppError('웹훅 처리 소유권이 변경되었습니다.', 503);
    return { received: true, ...result };
  } catch (error) {
    const manual =
      error.manualReview ||
      [400, 401, 403, 404].includes(error.response?.status) ||
      receipt.attempts >= 4;
    await prisma.paymentWebhookInbox.updateMany({
      where: owned,
      data: {
        status: manual ? 'manual_review' : 'failed',
        owner: null,
        lease_until: null,
        next_retry_at: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** receipt.attempts)),
        error_code: manual ? 'PROVIDER_RECONCILIATION_REQUIRED' : 'PROCESSING_FAILED',
      },
    });
    throw error;
  }
}
async function processEvent(event, io) {
  if (event.eventType.startsWith('Subscription.'))
    return { handled: false, reviewRequired: true, reason: 'UNVERIFIED_LEGACY_PROVIDER_CONTRACT' };
  if (event.eventType !== 'PAYMENT_STATUS_CHANGED')
    return { handled: false, reviewRequired: true, reason: 'UNSUPPORTED_EVENT_TYPE' };
  const Toss = require('../utils/toss'),
    verified = await Toss.getPayment(event.data.paymentKey);
  if (
    verified.orderId !== event.data.orderId ||
    Number(verified.totalAmount) !== Number(event.data.totalAmount)
  ) {
    const error = new AppError('PG 웹훅 거래 정보가 일치하지 않습니다.', 409);
    error.manualReview = true;
    throw error;
  }
  if (verified.status !== 'DONE' || event.data.status !== 'DONE')
    return {
      handled: false,
      reviewRequired: true,
      reason: 'PG_STATE_RECONCILIATION_REQUIRED',
      providerStatus: verified.status,
    };
  await new (require('./PaymentService'))(io).handleTossWebhook(event);
  return { handled: true };
}
async function resume(io, limit = 20) {
  const rows = await prisma.$transaction((tx) =>
    tx.paymentWebhookInbox.findMany({
      where: {
        attempts: { lt: 5 },
        OR: [
          { status: 'pending' },
          { status: 'failed', next_retry_at: { lte: new Date() } },
          { status: 'processing', lease_until: { lt: new Date() } },
        ],
      },
      orderBy: { created_at: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    })
  );
  const results = [];
  for (const row of rows) {
    try {
      const event = JSON.parse(decryptToken(row.payload_encrypted));
      results.push(
        await run(
          event,
          (e) =>
            row.kind === 'auto_cancel'
              ? require('./PaymentCompensationService').execute(e)
              : processEvent(e, io),
          row.kind
        )
      );
    } catch {
      results.push({ id: row.id, failed: true });
    }
  }
  return results;
}
module.exports = { normalize, run, processEvent, resume };

const StoreSubscriptionRepository = require('../repositories/StoreSubscription');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Toss 정기결제 웹훅 핸들러
 * 토스페이먼츠에서 발생하는 정기결제 이벤트 처리
 *
 * 이벤트 타입:
 * - Subscription.CREATED: 정기결제 생성
 * - Subscription.PAYMENT_SUCCEEDED: 정기결제 결제 성공
 * - Subscription.PAYMENT_FAILED: 정기결제 결제 실패
 * - Subscription.CANCELED: 정기결제 취소
 * - Subscription.PAUSED: 정기결제 일시정지
 * - Subscription.RESUMED: 정기결제 재개
 *
 * Toss는 실패 시 동일 웹훅을 재전송하므로 webhookId 기반 멱등성을 보장한다.
 */

// 웹훅 멱등성을 위한 webhookId → 처리 시각 캐시 (TTL 1시간, 최대 10,000건)
const dedupStore = new Map();
const DEDUP_TTL_MS = 60 * 60 * 1000;
const DEDUP_MAX_SIZE = 10000;

function isDuplicate(key) {
  if (!key) return false;
  const now = Date.now();
  if (dedupStore.has(key)) return true;
  dedupStore.set(key, now);
  if (dedupStore.size > DEDUP_MAX_SIZE) {
    for (const [k, ts] of dedupStore) {
      if (now - ts > DEDUP_TTL_MS) dedupStore.delete(k);
    }
  }
  return false;
}

/** Toss subscriptionId로 매장 구독 역매핑 — 실패 시 null + 경고 로그 */
async function resolveStoreSubscription(subscriptionId, eventType) {
  const storeSub = await StoreSubscriptionRepository.findBySubscriptionId(subscriptionId);
  if (!storeSub) {
    logger.warn(
      { eventType, subscriptionId },
      '정기결제 웹훅 역매핑 실패 — 매칭되는 매장 구독 없음 (무시)'
    );
    return null;
  }
  return storeSub;
}

/** 다음 결제/만료 시각 계산 (MONTHLY → +1개월, YEARLY → +1년) */
function computeNextPeriod(billingCycle, from = new Date()) {
  const next = new Date(from);
  if (billingCycle === 'YEARLY') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

async function handleSubscriptionWebhook(eventType, data) {
  logger.info({ eventType, subscriptionId: data?.subscriptionId }, '정기결제 웹훅 수신');

  // 멱등성: 동일 webhookId 중복 처리 방지
  const dedupKey = data?.webhookId || data?.eventId;
  if (isDuplicate(dedupKey)) {
    logger.info({ dedupKey, eventType }, '중복 정기결제 웹훅 무시');
    return { received: true, handled: false, duplicated: true };
  }

  try {
    switch (eventType) {
      case 'Subscription.CREATED':
        return await handleSubscriptionCreated(data);

      case 'Subscription.PAYMENT_SUCCEEDED':
        return await handlePaymentSucceeded(data);

      case 'Subscription.PAYMENT_FAILED':
        return await handlePaymentFailed(data);

      case 'Subscription.CANCELED':
        return await handleSubscriptionCanceled(data);

      case 'Subscription.PAUSED':
        return await handleSubscriptionPaused(data);

      case 'Subscription.RESUMED':
        return await handleSubscriptionResumed(data);

      default:
        logger.warn({ eventType }, '알 수 없는 정기결제 이벤트 타입');
        return { received: true, handled: false };
    }
  } catch (error) {
    logger.error({ eventType, error: error.message }, '정기결제 웹훅 처리 실패');
    throw error;
  }
}

async function handleSubscriptionCreated(data) {
  const { subscriptionId, customerKey, plan } = data;
  const eventType = 'Subscription.CREATED';
  logger.info({ subscriptionId, customerKey }, '정기결제 생성됨');

  // 정기결제 생성은 결제수단 등록 시점에 store_subscriptions upsert로 이미 반영됨.
  // 웹훅으로 도달 시 매핑이 있다면 자동 갱신 상태만 보장한다.
  const storeSub = await resolveStoreSubscription(subscriptionId, eventType);
  if (!storeSub) return { received: true, handled: false };

  await StoreSubscriptionRepository.upsertByStore(storeSub.store_id, {
    plan: plan || storeSub.plan || 'free',
    auto_renew: true,
  });

  return { received: true, handled: true };
}

async function handlePaymentSucceeded(data) {
  const { subscriptionId, paymentKey, amount, approvedAt } = data;
  const eventType = 'Subscription.PAYMENT_SUCCEEDED';
  logger.info({ subscriptionId, paymentKey, amount }, '정기결제 결제 성공');

  const storeSub = await resolveStoreSubscription(subscriptionId, eventType);
  if (!storeSub) return { received: true, handled: false };

  const now = new Date();
  const lastPaymentAt = approvedAt ? new Date(approvedAt) : now;
  const nextPaymentAt = computeNextPeriod(storeSub.billing_cycle || 'MONTHLY', lastPaymentAt);

  await StoreSubscriptionRepository.upsertByStore(storeSub.store_id, {
    billing_cycle: storeSub.billing_cycle || 'MONTHLY',
    auto_renew: true,
    last_payment_at: lastPaymentAt,
    next_payment_at: nextPaymentAt,
    plan_expires_at: nextPaymentAt,
  });

  return { received: true, handled: true };
}

async function handlePaymentFailed(data) {
  const { subscriptionId, paymentKey, failReason, failCode } = data;
  const eventType = 'Subscription.PAYMENT_FAILED';
  logger.warn({ subscriptionId, failReason, failCode }, '정기결제 결제 실패');

  const storeSub = await resolveStoreSubscription(subscriptionId, eventType);
  if (!storeSub) return { received: true, handled: false };

  // 미납 상태 처리: 자동 갱신 중단
  await StoreSubscriptionRepository.upsertByStore(storeSub.store_id, {
    auto_renew: false,
  });

  // 매장 운영자에게 알림 (발송 실패는 웹훅 처리를 중단시키지 않는다)
  try {
    await notificationService.createNotification({
      store_id: storeSub.store_id,
      type: 'PAYMENT_FAILED',
      title: '정기결제에 실패했어요',
      message: `자동결제가 실패했습니다. 결제 수단을 확인해 주세요.${
        failReason ? ` (${failReason})` : ''
      }`,
      data: { subscriptionId, failReason, failCode },
      priority: 'high',
      link: `/admin/stores/${storeSub.store_id}/settings/subscription`,
    });
  } catch (err) {
    logger.error(
      { error: err.message, storeId: storeSub.store_id },
      '정기결제 실패 알림 발송 오류'
    );
  }

  return { received: true, handled: true };
}

async function handleSubscriptionCanceled(data) {
  const { subscriptionId, cancelReason } = data;
  const eventType = 'Subscription.CANCELED';
  logger.info({ subscriptionId, cancelReason }, '정기결제 취소됨');

  return await setAutoRenew(subscriptionId, false, eventType);
}

async function handleSubscriptionPaused(data) {
  const { subscriptionId, pauseReason } = data;
  const eventType = 'Subscription.PAUSED';
  logger.info({ subscriptionId, pauseReason }, '정기결제 일시정지');

  return await setAutoRenew(subscriptionId, false, eventType);
}

async function handleSubscriptionResumed(data) {
  const { subscriptionId } = data;
  const eventType = 'Subscription.RESUMED';
  logger.info({ subscriptionId }, '정기결제 재개됨');

  return await setAutoRenew(subscriptionId, true, eventType);
}

/** 공용 상태 갱신 헬퍼 — auto_renew 반영 */
async function setAutoRenew(subscriptionId, autoRenew, eventType) {
  const storeSub = await resolveStoreSubscription(subscriptionId, eventType);
  if (!storeSub) return { received: true, handled: false };

  await StoreSubscriptionRepository.upsertByStore(storeSub.store_id, { auto_renew: autoRenew });
  return { received: true, handled: true };
}

module.exports = {
  handleSubscriptionWebhook,
  handleSubscriptionCreated,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionCanceled,
  handleSubscriptionPaused,
  handleSubscriptionResumed,
};

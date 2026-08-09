const SubscriptionService = require('../services/SubscriptionService');
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
 */
async function handleSubscriptionWebhook(eventType, data) {
  logger.info({ eventType, subscriptionId: data?.subscriptionId }, '정기결제 웹훅 수신');

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
  logger.info({ subscriptionId, customerKey }, '정기결제 생성됨');

  // 내부 구독 레코드와 매칭 (customerKey로 매칭 필요)
  // TODO: customerKey로 store 매핑 로직 추가
  return { received: true, handled: true };
}

async function handlePaymentSucceeded(data) {
  const { subscriptionId, paymentKey, amount, approvedAt } = data;
  logger.info({ subscriptionId, paymentKey, amount }, '정기결제 성공');

  // 내부 구독 갱신 로직
  // TODO: subscriptionId로 내부 구독 조회 후 갱신
  // await SubscriptionService.renewSubscription(internalSubscriptionId);

  return { received: true, handled: true };
}

async function handlePaymentFailed(data) {
  const { subscriptionId, paymentKey, failReason, failCode } = data;
  logger.warn({ subscriptionId, failReason, failCode }, '정기결제 실패');

  // 결제 실패 처리: 재시도 로직, 알림 발송 등
  // TODO: 재시도 스케줄링, 알림 발송

  return { received: true, handled: true };
}

async function handleSubscriptionCanceled(data) {
  const { subscriptionId, cancelReason } = data;
  logger.info({ subscriptionId, cancelReason }, '정기결제 취소됨');

  // 내부 구독 취소 처리
  // TODO: 내부 구독 상태 업데이트

  return { received: true, handled: true };
}

async function handleSubscriptionPaused(data) {
  const { subscriptionId, pauseReason } = data;
  logger.info({ subscriptionId, pauseReason }, '정기결제 일시정지');

  return { received: true, handled: true };
}

async function handleSubscriptionResumed(data) {
  const { subscriptionId } = data;
  logger.info({ subscriptionId }, '정기결제 재개됨');

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

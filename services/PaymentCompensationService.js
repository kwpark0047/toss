const crypto = require('node:crypto');
const gateway = require('../utils/toss');
const inbox = require('./PaymentWebhookInbox');
const { AppError } = require('../utils/errorHandler');
async function execute(event) {
  const key = event.data.paymentKey,
    payment = await gateway.getPayment(key);
  if (
    payment.paymentKey !== key ||
    !Number.isSafeInteger(Number(payment.totalAmount)) ||
    Number(payment.totalAmount) <= 0
  ) {
    const error = new AppError('자동 취소 대사가 필요합니다.', 409);
    error.manualReview = true;
    throw error;
  }
  if (payment.status === 'CANCELED' && Number(payment.balanceAmount) === 0)
    return { confirmed: true, alreadyCanceled: true };
  const amount = Number(payment.balanceAmount);
  if (
    !['DONE', 'PARTIAL_CANCELED'].includes(payment.status) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    const error = new AppError('자동 취소 상태 확인이 필요합니다.', 409);
    error.manualReview = true;
    throw error;
  }
  const result = await gateway.cancelPayment(key, event.data.cancelReason, amount, event.eventId);
  if (
    result.paymentKey !== key ||
    result.status !== 'CANCELED' ||
    Number(result.balanceAmount) !== 0
  ) {
    const error = new AppError('PG 취소 결과 확인이 필요합니다.', 409);
    error.manualReview = true;
    throw error;
  }
  return { confirmed: true, canceledAmount: amount };
}
async function autoCancel(paymentKey, reason) {
  const event = {
    eventType: 'AUTO_PAYMENT_CANCEL',
    eventId: 'auto-cancel:' + crypto.createHash('sha256').update(paymentKey).digest('hex'),
    data: { paymentKey, cancelReason: reason },
  };
  const result = await inbox.run(event, execute, 'auto_cancel');
  if (result.reviewRequired) throw new AppError('자동 취소 대사가 필요합니다.', 409);
  return result;
}
module.exports = { autoCancel, execute };

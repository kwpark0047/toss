const { AppError } = require('./errorHandler');

const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
  confirmed: ['preparing', 'ready', 'completed', 'cancelled'],
  preparing: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
});

const KDS_STATUS_TRANSITIONS = Object.freeze({
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
});

const assertTransition = (transitions, currentStatus, nextStatus, label) => {
  if (
    !Object.prototype.hasOwnProperty.call(transitions, nextStatus) ||
    !Object.prototype.hasOwnProperty.call(transitions, currentStatus)
  ) {
    throw new AppError(`유효하지 않은 ${label} 상태입니다.`, 400);
  }
  if (currentStatus === nextStatus) return;
  if (!transitions[currentStatus].includes(nextStatus)) {
    throw new AppError(`현재 ${currentStatus} 상태에서는 ${nextStatus}로 변경할 수 없습니다.`, 400);
  }
};

const assertOrderStatusTransition = (currentStatus, nextStatus) =>
  assertTransition(ORDER_STATUS_TRANSITIONS, currentStatus, nextStatus, '주문');

const assertKdsOrderStatusTransition = (currentStatus, nextStatus) =>
  assertTransition(KDS_STATUS_TRANSITIONS, currentStatus, nextStatus, 'KDS 주문');

module.exports = {
  ORDER_STATUS_TRANSITIONS,
  KDS_STATUS_TRANSITIONS,
  assertOrderStatusTransition,
  assertKdsOrderStatusTransition,
};

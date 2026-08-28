import { AppError } from './errorHandler.js';

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
  confirmed: ['preparing', 'ready', 'completed', 'cancelled'],
  preparing: ['ready', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const);

export const KDS_STATUS_TRANSITIONS = Object.freeze({
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
} as const);

export type OrderStatus = keyof typeof ORDER_STATUS_TRANSITIONS;
export type KdsOrderStatus = keyof typeof KDS_STATUS_TRANSITIONS;

const assertTransition = (
  transitions: Record<string, string[]>,
  currentStatus: string,
  nextStatus: string,
  label: string
): void => {
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

export const assertOrderStatusTransition = (currentStatus: string, nextStatus: string): void =>
  assertTransition(ORDER_STATUS_TRANSITIONS, currentStatus, nextStatus, '주문');

export const assertKdsOrderStatusTransition = (currentStatus: string, nextStatus: string): void =>
  assertTransition(KDS_STATUS_TRANSITIONS, currentStatus, nextStatus, 'KDS 주문');

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]>;
export const KDS_STATUS_TRANSITIONS: Record<string, string[]>;
export const assertOrderStatusTransition: typeof assertOrderStatusTransition;
export const assertKdsOrderStatusTransition: typeof assertKdsOrderStatusTransition;
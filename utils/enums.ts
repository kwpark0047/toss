/**
 * 데이터베이스 Schema Enum에 해당하는 상수 정의
 */

export const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const OrderPaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type OrderPaymentStatus = typeof OrderPaymentStatus[keyof typeof OrderPaymentStatus];

export const PaymentTxStatus = {
  PENDING: 'pending',
  READY: 'READY',
  DONE: 'DONE',
  CANCELED: 'CANCELED',
  PARTIAL_CANCELED: 'PARTIAL_CANCELED',
} as const;

export type PaymentTxStatus = typeof PaymentTxStatus[keyof typeof PaymentTxStatus];

export default {
  OrderStatus,
  OrderPaymentStatus,
  PaymentTxStatus,
};
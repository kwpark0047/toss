// utils/enums.js
// 데이터베이스 Schema Enum에 해당하는 상수 정의

const OrderStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const OrderPaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const PaymentTxStatus = {
  PENDING: 'pending',
  READY: 'READY',
  DONE: 'DONE',
  CANCELED: 'CANCELED',
  PARTIAL_CANCELED: 'PARTIAL_CANCELED',
};

module.exports = {
  OrderStatus,
  OrderPaymentStatus,
  PaymentTxStatus,
};

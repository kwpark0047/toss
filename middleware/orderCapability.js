const {
  verifyOrderCapability,
  verifyReservationCapability,
  verifyWalletCapability,
} = require('../utils/orderCapability');

const orderCapability = (req, res, next) => {
  const capability = verifyOrderCapability(req.get('x-order-capability'));
  const requestedOrderId = Number(req.body?.order_id || req.params?.orderId);

  if (
    !capability ||
    !Number.isInteger(requestedOrderId) ||
    capability.orderId !== requestedOrderId
  ) {
    return res.status(403).json({ error: '주문 결제 권한이 없거나 만료되었습니다.' });
  }

  req.orderCapability = capability;
  next();
};

function requireReservationCustomerCapability(req, res, next) {
  const token = req.get('x-reservation-capability') || req.get('x-order-capability');
  const capability = verifyReservationCapability(token);
  if (!capability) {
    return res.status(403).json({ error: '예약 조회 권한이 없거나 만료되었습니다.' });
  }
  const requestedId = Number(req.params.id || req.params.reservationId);
  if (requestedId && capability.id !== requestedId) {
    return res.status(403).json({ error: '예약 조회 권한이 없습니다.' });
  }
  const requestedStoreId = Number(req.params.storeId || req.body?.store_id);
  const requestedPhone = req.params.phone || req.body?.phone;
  if (requestedStoreId && capability.store_id !== requestedStoreId) {
    return res.status(403).json({ error: '예약 조회 권한이 없습니다.' });
  }
  if (requestedPhone && capability.customer_phone !== requestedPhone) {
    return res.status(403).json({ error: '예약 조회 권한이 없습니다.' });
  }
  req.capability = capability;
  next();
}

function requireOrderCapabilityOrAuth(req, res, next) {
  if (req.user) return next();

  const capability = verifyOrderCapability(req.get('x-order-capability'));
  const requestedOrderId = Number(req.params.id || req.params.orderId || req.body?.order_id);

  if (
    !capability ||
    !Number.isInteger(requestedOrderId) ||
    capability.orderId !== requestedOrderId
  ) {
    return res.status(403).json({ error: '주문 조회 권한이 없거나 만료되었습니다.' });
  }

  req.orderCapability = capability;
  next();
}

function requireWalletCapability(req, res, next) {
  const token = req.get('x-wallet-capability') || req.get('x-order-capability');
  const capability = verifyWalletCapability(token);
  if (!capability) {
    return res.status(403).json({ error: '포인트 조회 권한이 없거나 만료되었습니다.' });
  }
  const requestedStoreId = Number(req.query.store_id || req.params.storeId);
  const requestedPhone = req.query.phone || req.params.phone;
  if (requestedStoreId && capability.store_id !== requestedStoreId) {
    return res.status(403).json({ error: '포인트 조회 권한이 없습니다.' });
  }
  if (requestedPhone && capability.customer_phone !== requestedPhone) {
    return res.status(403).json({ error: '포인트 조회 권한이 없습니다.' });
  }
  req.capability = capability;
  next();
}

module.exports = orderCapability;
module.exports.requireReservationCustomerCapability = requireReservationCustomerCapability;
module.exports.requireOrderCapabilityOrAuth = requireOrderCapabilityOrAuth;
module.exports.requireWalletCapability = requireWalletCapability;

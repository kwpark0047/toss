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
  req.capability = capability;
  next();
}

function requireWalletCapability(req, res, next) {
  const token = req.get('x-wallet-capability') || req.get('x-order-capability');
  const capability = verifyWalletCapability(token);
  if (!capability) {
    return res.status(403).json({ error: '포인트 조회 권한이 없거나 만료되었습니다.' });
  }
  req.capability = capability;
  next();
}

module.exports = orderCapability;
module.exports.requireReservationCustomerCapability = requireReservationCustomerCapability;
module.exports.requireWalletCapability = requireWalletCapability;

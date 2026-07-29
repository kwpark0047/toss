const { verifyOrderCapability } = require('../utils/orderCapability');

module.exports = (req, res, next) => {
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

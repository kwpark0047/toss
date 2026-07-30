const prisma = require('../config/prisma');
const { verifyOrderCapability } = require('../utils/orderCapability');

module.exports = async (req, res, next) => {
  try {
    const paymentId = Number(req.params.orderId);
    const capability = verifyOrderCapability(req.get('x-order-capability'));

    if (!Number.isInteger(paymentId) || !capability) {
      return res.status(403).json({ error: '주문 결제 권한이 없거나 만료되었습니다.' });
    }

    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      select: { order_id: true },
    });

    if (!payment?.order_id || payment.order_id !== capability.orderId) {
      return res.status(403).json({ error: '주문 결제 권한이 없거나 만료되었습니다.' });
    }

    req.orderCapability = capability;
    req.payment = payment;
    return next();
  } catch (error) {
    return next(error);
  }
};

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

async function paymentCapabilityOrStoreAuth(req, res, next) {
  try {
    const paymentId = Number(req.params.paymentId);
    const capability = verifyOrderCapability(req.get('x-order-capability'));
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      select: { order_id: true, store_id: true },
    });

    if (!payment) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
    if (capability?.orderId === payment.order_id) {
      req.orderCapability = capability;
      return next();
    }

    if (!req.user) return res.status(403).json({ error: '결제 접근 권한이 없습니다.' });
    if (req.user.role === 'super_admin') return next();

    const { getStoreRole } = require('./storeAuth');
    const role = await getStoreRole(req.user.id, payment.store_id);
    if (!['owner', 'manager', 'staff', 'kitchen'].includes(role)) {
      return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports.paymentCapabilityOrStoreAuth = paymentCapabilityOrStoreAuth;

const express = require('express');
const prisma = require('../config/prisma');
const push = require('../services/OrderWebPushService');
const {
  verifyOrderCapability,
  verifyCustomerHistoryCapability,
} = require('../utils/orderCapability');
const router = express.Router();
router.get('/push/config', (_req, res) =>
  res.json({ enabled: !!push.config(), publicKey: push.config()?.publicKey || null })
);
async function authorize(req, res, next) {
  const id = Number(req.params.id);
  const cap = verifyOrderCapability(req.get('x-order-capability'));
  const history = verifyCustomerHistoryCapability(req.get('x-customer-history-capability'));
  const scope = cap?.orderId === id ? cap : history?.orderIds.includes(id) ? history : null;
  if (!Number.isSafeInteger(id) || id <= 0 || !scope)
    return res.status(403).json({ error: '주문 조회 권한이 없거나 만료됐어요.' });
  try {
    const order = await prisma.orders.findUnique({
      where: { id },
      select: { store_id: true, status: true },
    });
    if (!order || order.store_id !== scope.storeId)
      return res.status(403).json({ error: '주문 조회 권한이 없습니다.' });
    if (req.method === 'POST' && ['completed', 'cancelled'].includes(order.status))
      return res.status(409).json({ error: '종료된 주문입니다.' });
    next();
  } catch (error) {
    next(error);
  }
}
router.post('/:id/push-subscription', authorize, async (req, res, next) => {
  try {
    await push.subscribe(Number(req.params.id), req.body?.subscription);
    res.json({ subscribed: true });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
router.delete('/:id/push-subscription', authorize, async (req, res, next) => {
  try {
    await push.unsubscribe(Number(req.params.id), req.body?.endpoint);
    res.json({ subscribed: false });
  } catch (error) {
    next(error);
  }
});
module.exports = router;

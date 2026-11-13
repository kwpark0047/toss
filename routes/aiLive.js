const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('express-rate-limit');
const { getGateway } = require('../services/ai/live/runtime');
function createLiveRouter(resolve = getGateway, identity = optionalAuth) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/session',
    rateLimit({ windowMs: 60000, limit: 6, standardHeaders: true, legacyHeaders: false }),
    identity,
    async (req, res) => {
      try {
        const gateway = resolve();
        if (!gateway.policy.enabled || !gateway.policy.allowPaid)
          return res.status(503).json({
            success: false,
            fallback: 'legacy_voice',
            message: '기존 음성 주문을 이용해 주세요.',
          });
        if (req.body?.purpose === 'manager' && !req.user)
          return res.status(401).json({ success: false, fallback: 'legacy_voice' });
        const result = await gateway.issue({
          storeId: req.body?.storeId,
          purpose: req.body?.purpose,
          consent: req.body?.consent,
          origin: req.get('origin'),
          user: req.user,
          ip: req.ip,
          idempotencyKey: req.get('Idempotency-Key'),
        });
        return res.status(201).json({ success: true, data: result });
      } catch {
        return res.status(403).json({
          success: false,
          fallback: 'legacy_voice',
          message: '실시간 음성 연결을 시작할 수 없어요. 기존 음성 주문을 이용해 주세요.',
        });
      }
    }
  );
  return router;
}
module.exports = createLiveRouter();
module.exports.createLiveRouter = createLiveRouter;

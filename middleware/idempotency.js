const crypto = require('crypto');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

function idempotencyMiddleware(options = {}) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!key) {
      if (options.required)
        return res
          .status(400)
          .json({ success: false, error: 'Idempotency-Key header is required.' });
      return next();
    }
    if (typeof key !== 'string' || key.length > 255 || !key.trim()) {
      return res.status(400).json({ success: false, error: 'Invalid Idempotency-Key.' });
    }
    const principal = req.user?.id
      ? 'user:' + req.user.id
      : req.orderCapability?.orderId
        ? 'order:' + req.orderCapability.orderId
        : 'anon';
    const scope = [
      options.namespace || 'default',
      principal,
      req.method,
      req.baseUrl || '',
      req.path || '',
      key,
    ];
    const id = crypto.createHash('sha256').update(JSON.stringify(scope)).digest('hex');
    const bodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');
    try {
      try {
        await prisma.idempotencyRecord.create({
          data: { id, body_hash: bodyHash, status: 'processing' },
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        const record = await prisma.idempotencyRecord.findUnique({ where: { id } });
        if (!record) throw new Error('Idempotency state missing');
        if (record.body_hash !== bodyHash)
          return res
            .status(422)
            .json({ success: false, error: 'Idempotency-Key reused with different request body.' });
        if (record.status === 'completed') {
          return res
            .set('Idempotency-Replayed', 'true')
            .status(record.status_code)
            .json(record.response);
        }
        // Never automatically reclaim a request whose financial outcome is unknown.
        return res
          .set('Retry-After', '2')
          .status(409)
          .json({ success: false, error: 'Request is processing or requires reconciliation.' });
      }
    } catch (error) {
      logger.error('Idempotency store unavailable', { error: error.message });
      return res.status(503).json({
        success: false,
        error: 'Duplicate protection unavailable. Retry with the same key.',
      });
    }
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        await prisma.idempotencyRecord.update({
          where: { id },
          data: {
            status: res.statusCode >= 500 ? 'uncertain' : 'completed',
            status_code: res.statusCode,
            response: JSON.parse(JSON.stringify(body)),
          },
        });
        return originalJson(body);
      } catch (error) {
        logger.error('Idempotency result persistence failed', { error: error.message });
        res.statusCode = 503;
        return originalJson({
          success: false,
          error: 'Result requires reconciliation. Retry with the same key.',
        });
      }
    };
    return next();
  };
}
module.exports = idempotencyMiddleware;

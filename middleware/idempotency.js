const NodeCache = require('node-cache');
const idempotencyCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minutes TTL
const { apiLogger } = require('../utils/logger');

/**
 * Idempotency Middleware factory to prevent double-spending / duplicate orders/payments
 * @param {Object} options
 */
function idempotencyMiddleware(options = {}) {
  return function (req, res, next) {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!key) {
      if (options.required) {
        return res
          .status(400)
          .json({ success: false, error: 'Idempotency-Key header is required.' });
      }
      return next();
    }

    const namespace = options.namespace || 'default';
    const cacheKey = `idempotency:${namespace}:${req.user?.id || 'anon'}:${key}`;
    const cachedResponse = idempotencyCache.get(cacheKey);

    if (cachedResponse) {
      apiLogger.warn(
        { idempotencyKey: key, namespace },
        'Idempotent replay detected, returning cached response'
      );
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyCache.set(cacheKey, {
          status: res.statusCode,
          body,
        });
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = idempotencyMiddleware;

const NodeCache = require('node-cache');
const memoryCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minutes TTL
const logger = require('../utils/logger');
const redisCache = require('../utils/redisCache');
const crypto = require('crypto');

/**
 * Idempotency Middleware factory to prevent double-spending / duplicate orders/payments
 * @param {Object} options
 */
function idempotencyMiddleware(options = {}) {
  return async function (req, res, next) {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!key) {
      if (options.required) {
        return res
          .status(400)
          .json({ success: false, error: 'Idempotency-Key header is required.' });
      }
      return next();
    }

    if (typeof key !== 'string' || key.length > 255) {
      return res
        .status(400)
        .json({ success: false, error: 'Idempotency-Key is too long or invalid.' });
    }

    const namespace = options.namespace || 'default';
    const cacheKey = `idempotency:${namespace}:${req.user?.id || 'anon'}:${key}`;
    const inflightKey = `${cacheKey}:inflight`;

    // Compute hash of request body for validation
    const bodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    try {
      let cachedResponse = null;
      let cachedBodyHash = null;
      let inflight = false;
      if (redisCache.isConnected) {
        const val = await redisCache.get(cacheKey);
        if (val) {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          cachedResponse = parsed;
          cachedBodyHash = parsed.bodyHash || null;
        }
        inflight = !!(await redisCache.get(inflightKey));
      } else {
        cachedResponse = memoryCache.get(cacheKey);
        cachedBodyHash = memoryCache.get(`${cacheKey}:bodyHash`) || null;
        inflight = !!memoryCache.get(inflightKey);
      }

      if (cachedResponse) {
        // Validate that request body matches original
        if (cachedBodyHash && bodyHash !== cachedBodyHash) {
          logger.warn(
            { idempotencyKey: key, namespace },
            'Idempotency key reused with different body'
          );
          return res
            .status(422)
            .json({ success: false, error: 'Idempotency-Key reused with different request body.' });
        }

        logger.warn(
          { idempotencyKey: key, namespace },
          'Idempotent replay detected, returning cached response'
        );
        return res
          .set('Idempotency-Replayed', 'true')
          .status(cachedResponse.status)
          .json(cachedResponse.body);
      }

      if (inflight) {
        logger.warn(
          { idempotencyKey: key, namespace },
          'Idempotency key already in-flight, rejecting duplicate'
        );
        return res.set('Retry-After', '2').status(409).json({
          success: false,
          error: 'Duplicate request is being processed. Retry after a short delay.',
        });
      }

      // Mark request as in-flight so concurrent duplicates are rejected.
      if (redisCache.isConnected) {
        redisCache.set(inflightKey, '1', 60).catch(() => {});
      } else {
        memoryCache.set(inflightKey, true, 60);
      }
    } catch (e) {
      if (logger.apiLogger?.warn) {
        logger.apiLogger.warn({ error: e.message }, 'Idempotency cache read failed');
      } else if (logger.warn) {
        logger.warn({ error: e.message }, 'Idempotency cache read failed');
      }
    }

    const clearInflight = () => {
      if (redisCache.isConnected) {
        redisCache.del(inflightKey).catch(() => {});
      } else {
        memoryCache.del(inflightKey);
      }
    };

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      clearInflight();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload = { status: res.statusCode, body, bodyHash };
        memoryCache.set(cacheKey, payload);
        memoryCache.set(`${cacheKey}:bodyHash`, bodyHash);
        if (redisCache.isConnected) {
          redisCache.set(cacheKey, JSON.stringify({ ...payload, bodyHash }), 600).catch(() => {});
        }
      }
      return originalJson(body);
    };

    if (typeof res.on === 'function') {
      res.on('close', clearInflight);
      res.on('finish', clearInflight);
    }

    next();
  };
}

// Support test helper method
idempotencyMiddleware._clearMemoryStore = () => {
  memoryCache.flushAll();
};

module.exports = idempotencyMiddleware;

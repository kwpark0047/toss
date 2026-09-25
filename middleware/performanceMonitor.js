const logger = require('../utils/logger');
const sentry = require('../utils/sentry');

const performanceMonitor = (req, res, next) => {
  const start = Date.now();

  // Sentry 자식 스팬 (http.handler) — 비활성/미구현 환경(mock)에서는 null
  const span = typeof sentry?.startSpan === 'function'
    ? sentry.startSpan(`${req.method} ${req.originalUrl}`, { op: 'http.handler' })
    : null;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`[Performance] ${req.method} ${req.originalUrl} - ${duration}ms`);

    if (span && typeof span === 'object') {
      try {
        const route =
          `${req.baseUrl || ''}${req.route && req.route.path ? req.route.path : ''}` ||
          req.originalUrl;
        if (typeof span.updateName === 'function') {
          span.updateName(`${req.method} ${route}`);
        }
        if (typeof span.setTag === 'function') {
          span.setTag('http.status_code', res.statusCode);
          span.setTag('user_role', req.user && req.user.role ? req.user.role : 'anonymous');
          if (req.user && req.user.id) span.setTag('user_id', String(req.user.id));
        }
      } catch (e) {
        logger.debug(`[Performance] Sentry 스팬 보강 실패: ${e.message}`);
      } finally {
        if (typeof span.end === 'function') span.end();
      }
    }
  });

  next();
};

module.exports = performanceMonitor;
/**
 * rateLimiter.js — 엔드포인트별 요청 속도 제한 (express-rate-limit v7)
 */
const rateLimit = require('express-rate-limit');
const alerting = require('../utils/alerting');
const logger = require('../utils/logger');

const makeHandler = (message, limitLabel) => (req, res) => {
  logger.warn(`[RateLimit] 한도 초과: ${req.ip} → ${req.originalUrl} (${limitLabel})`);
  alerting.send({
    level: 'warn',
    title: `요청 한도 초과: ${limitLabel}`,
    message: `IP: ${req.ip} | 경로: ${req.originalUrl}`,
    meta: { ip: req.ip, path: req.originalUrl },
  });
  res
    .status(429)
    .json({ success: false, error: message, retryAfter: '잠시 후 다시 시도해주세요.' });
};

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skip: (req) => {
    if (req.path === '/api/health' || req.path === '/api/health/deep') return true;
    const isPublicGet =
      req.method === 'GET' &&
      (req.path.startsWith('/api/tables/qr/') ||
        req.path.startsWith('/api/stores/') ||
        req.path.startsWith('/api/categories/store/') ||
        req.path.startsWith('/api/products/store/') ||
        req.path.startsWith('/api/weather/'));
    if (isPublicGet) return true;
    return false;
  },
  handler: makeHandler('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'general'),
});

const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: makeHandler('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'public'),
});

// ── 2. 주문 생성: 30 req / 1분 / IP (피크 보호) ──────────────────────────────
const orderLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const storeId = req.body?.store_id || req.params?.storeId || '';
    return `${req.ip}:order:${storeId}`;
  },
  handler: makeHandler('주문 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'order'),
});

// ── 3. 인증: 10 req / 15분 / IP (브루트포스 방지)
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skipSuccessfulRequests: true,
  handler: makeHandler('로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.', 'auth'),
});

// ── 4. SMS / 외부 비용 API: 3 req / 10분 / IP ────────────────────────────────
const smsLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 3,
  validate: { xForwardedForHeader: false },
  handler: makeHandler('SMS 요청 한도를 초과했습니다.', 'sms'),
});

// ── 5. 결제 생성: 10 req / 1분 / IP ─────────────────────────────────────────
// (테스트 환경에서는 웹훅 회귀 테스트가 여러 번 호출하므로 한도 완화)
const paymentLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: makeHandler('결제 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'payment'),
});

module.exports = {
  generalLimiter,
  publicLimiter,
  orderLimiter,
  authLimiter,
  smsLimiter,
  paymentLimiter,
};

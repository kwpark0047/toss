const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const IS_DEV = process.env.NODE_ENV !== 'production';

if (!JWT_SECRET && !IS_DEV) {
  logger.error('[FATAL] JWT_SECRET is not set.');
  process.exit(1);
}

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

const authMiddleware = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: '인증 토큰이 필요합니다.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type === 'refresh') return res.status(401).json({ error: '액세스 토큰이 필요합니다.' });

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'refresh') req.user = decoded;
    }
    next();
  } catch {
    next();
  }
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuth = optionalAuth;

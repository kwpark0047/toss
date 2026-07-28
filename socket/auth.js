const jwt = require('jsonwebtoken');

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function getHandshakeToken(handshake = {}) {
  if (handshake.auth?.token) return handshake.auth.token;

  const authorization = handshake.headers?.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);

  return getCookieValue(handshake.headers?.cookie, 'token');
}

function authenticateSocket(socket, next) {
  const token = getHandshakeToken(socket.handshake);
  socket.data = socket.data || {};

  if (!token) {
    socket.data.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') throw new Error('Access token required');
    socket.data.user = decoded;
    return next();
  } catch {
    const error = new Error('유효한 액세스 토큰이 필요합니다.');
    error.data = { code: 'UNAUTHENTICATED' };
    return next(error);
  }
}

module.exports = { authenticateSocket, getHandshakeToken };

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const accessSecret = () => process.env.JWT_SECRET;
const refreshSecret = () => process.env.JWT_REFRESH_SECRET || accessSecret();
function tokens(user, sid) {
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role || 'user', type: 'access', sid },
    accessSecret(),
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '2h',
      jwtid: crypto.randomUUID(),
    }
  );
  const refreshToken = jwt.sign({ id: user.id, type: 'refresh', sid }, refreshSecret(), {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    jwtid: crypto.randomUUID(),
  });
  return { token, refreshToken };
}
function read(token, type) {
  const decoded = jwt.verify(token, type === 'refresh' ? refreshSecret() : accessSecret(), {
    algorithms: ['HS256'],
  });
  if (decoded.type !== type || typeof decoded.sid !== 'string' || !Number.isSafeInteger(decoded.id))
    throw new AppError('로그인이 필요합니다.', 401);
  return decoded;
}
module.exports = {
  async issue(user, transaction = null) {
    const issue = async (tx) => {
      const locked = await tx.$queryRawUnsafe(
        'SELECT id,auth_status FROM users WHERE id=$1 FOR UPDATE',
        user.id
      );
      if (!locked[0] || locked[0].auth_status !== 'active')
        throw new AppError('로그인이 필요합니다.', 401);
      const sid = crypto.randomUUID(),
        pair = tokens(user, sid);
      await tx.authSession.create({
        data: {
          id: sid,
          user_id: user.id,
          refresh_hash: digest(pair.refreshToken),
          expires_at: new Date(jwt.decode(pair.refreshToken).exp * 1000),
        },
      });
      return pair;
    };
    return transaction ? issue(transaction) : prisma.$transaction(issue);
  },
  async verifyAccess(decoded) {
    if (!decoded.sid) throw new AppError('다시 로그인해 주세요.', 401);
    return prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { id: decoded.sid },
        include: { user: true },
      });
      if (
        !session ||
        session.user_id !== decoded.id ||
        session.revoked_at ||
        session.expires_at <= new Date() ||
        !session.user ||
        session.user.auth_status === 'deletion_pending'
      )
        throw new AppError('세션이 만료되었습니다.', 401);
      // Primary account role replaces the stale JWT snapshot, including admin removal.
      return { ...decoded, name: session.user.name, role: session.user.role || 'user' };
    });
  },
  async rotate(refreshToken) {
    const decoded = read(refreshToken, 'refresh');
    const outcome = await prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { id: decoded.sid },
        include: { user: true },
      });
      if (
        !session ||
        session.user_id !== decoded.id ||
        session.revoked_at ||
        session.expires_at <= new Date() ||
        !session.user ||
        session.user.auth_status === 'deletion_pending'
      )
        return null;
      if (session.refresh_hash !== digest(refreshToken)) {
        await tx.authSession.updateMany({
          where: { id: session.id, revoked_at: null },
          data: { revoked_at: new Date() },
        });
        return null;
      }
      const pair = tokens(session.user, session.id);
      const changed = await tx.authSession.updateMany({
        where: {
          id: session.id,
          refresh_hash: session.refresh_hash,
          revoked_at: null,
          expires_at: { gt: new Date() },
        },
        data: {
          refresh_hash: digest(pair.refreshToken),
          expires_at: new Date(jwt.decode(pair.refreshToken).exp * 1000),
        },
      });
      if (changed.count !== 1) return null;
      return pair;
    });
    if (!outcome) throw new AppError('세션이 만료되었습니다. 다시 로그인해 주세요.', 401);
    return outcome;
  },
  async revoke(token, type = 'access') {
    if (!token) return;
    let decoded;
    try {
      decoded = read(token, type);
    } catch {
      return;
    }
    await prisma.authSession.updateMany({
      where: { id: decoded.sid, user_id: decoded.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    const io = require('./DashboardBroadcastService').io;
    if (io) io.in(`auth-session:${decoded.sid}`).disconnectSockets(true);
  },
};

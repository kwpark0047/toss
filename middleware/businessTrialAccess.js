const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

async function findExpiredTrial(userId) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT business_access_status, trial_ends_at FROM public.users WHERE id=$1 LIMIT 1',
    Number(userId)
  );
  const user = rows[0];
  return user?.business_access_status === 'trialing' &&
    user.trial_ends_at && new Date(user.trial_ends_at).getTime() <= Date.now();
}

async function assertUserCanWrite(userId) {
  if (await findExpiredTrial(userId))
    throw new AppError('1개월 체험이 종료되었습니다. 최고관리자의 정식 이용 승인을 기다려 주세요.', 403, 'TRIAL_EXPIRED');
}

async function requireUnexpiredTrial(req, res, next) {
  try {
    await assertUserCanWrite(req.user.id);
    next();
  } catch (error) {
    if (error.code === 'TRIAL_EXPIRED')
      return res.status(403).json({ error: error.message, code: error.code });
    next(error);
  }
}

module.exports = { findExpiredTrial, assertUserCanWrite, requireUnexpiredTrial };


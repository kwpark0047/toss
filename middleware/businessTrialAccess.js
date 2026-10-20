const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const RESTRICTED_ACCESS = new Set(['suspended', 'fraud_review', 'rejected']);
const RESTRICTED_MESSAGES = {
  suspended: [
    '사업자 계정이 일시 중단되었습니다. 최고관리자에게 문의해 주세요.',
    'BUSINESS_ACCOUNT_SUSPENDED',
  ],
  fraud_review: ['사업자 계정이 안전성 검토로 일시 제한되었습니다.', 'BUSINESS_ACCOUNT_REVIEW'],
  rejected: [
    '사업자 계정 이용이 중단되었습니다. 최고관리자에게 문의해 주세요.',
    'BUSINESS_ACCOUNT_REJECTED',
  ],
};

async function getBusinessAccess(userId) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT business_access_status, trial_ends_at, auth_status FROM public.users WHERE id=$1 LIMIT 1',
    Number(userId)
  );
  return rows[0] || null;
}

function throwIfRestricted(account) {
  if (account && RESTRICTED_ACCESS.has(account.business_access_status)) {
    const [message, code] = RESTRICTED_MESSAGES[account.business_access_status];
    throw new AppError(message, 403, code);
  }
}

async function assertUserCanAccess(userId) {
  throwIfRestricted(await getBusinessAccess(userId));
}

async function findExpiredTrial(userId) {
  const user = await getBusinessAccess(userId);
  return (
    user?.business_access_status === 'trialing' &&
    user.trial_ends_at &&
    new Date(user.trial_ends_at).getTime() <= Date.now()
  );
}

async function assertUserCanWrite(userId) {
  const account = await getBusinessAccess(userId);
  throwIfRestricted(account);
  if (
    account?.business_access_status === 'trialing' &&
    account.trial_ends_at &&
    new Date(account.trial_ends_at).getTime() <= Date.now()
  )
    throw new AppError(
      '1개월 체험이 종료되었습니다. 최고관리자의 정식 이용 승인을 기다려 주세요.',
      403,
      'TRIAL_EXPIRED'
    );
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

module.exports = {
  findExpiredTrial,
  getBusinessAccess,
  assertUserCanAccess,
  assertUserCanWrite,
  requireUnexpiredTrial,
};

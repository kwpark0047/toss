const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const { sendSms } = require('../utils/smsService');
const { decryptPhone } = require('../utils/phoneEncryption');
const { setTokenCookies } = require('../utils/tokenCookies');
const userRepository = require('../app/lib/repositories/user.repository');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const IS_DEV = process.env.NODE_ENV !== 'production';

const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '2h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const signTokens = (user) => {
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role || 'user', type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
  return { token, refreshToken };
};

const safeUser = (user) => {
  const { password: _, ...rest } = user;
  return rest;
};

/**
 * temp_token 검증 헬퍼
 */
const verifyTempToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== '2fa_pending') return null;
    return decoded;
  } catch {
    return null;
  }
};

/**
 * 2차 로그인 OTP 발송 (temp_token 필요)
 * POST /api/admin/auth/send-2fa-otp
 * Body: (none)
 */
const sendLoginOtp = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tempToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const decoded = verifyTempToken(tempToken);
    if (!decoded) return next(new AppError('임시 토큰이 유효하지 않거나 만료되었습니다.', 401));

    const user = await userRepository.findUnique(decoded.id);
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    // 기존 미사용 LOGIN OTP 무효화
    await prisma.admin_otps.updateMany({
      where: { user_id: user.id, purpose: 'LOGIN', used: false },
      data: { used: true },
    });

    const phone = decryptPhone(user.phone);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.admin_otps.create({
      data: { user_id: user.id, otp, purpose: 'LOGIN', expires_at: expiresAt },
    });

    await sendSms(phone, `[위마켓] 2차 로그인 인증번호: ${otp}`);

    const responseData = { message: '2FA 인증번호가 발송되었습니다.' };
    if (IS_DEV || !process.env.SMS_ENV || process.env.SMS_ENV === 'none') {
      responseData.dev_otp = otp;
    }

    res.success(responseData, '2FA 인증번호가 발송되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * 2차 로그인 OTP 검증 (temp_token + otp) → 최종 JWT 발급
 * POST /api/admin/auth/verify-2fa-otp
 * Body: { otp }
 */
const verifyLoginOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const authHeader = req.headers.authorization;
    const tempToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const decoded = verifyTempToken(tempToken);

    if (!decoded) return next(new AppError('임시 토큰이 유효하지 않거나 만료되었습니다.', 401));
    if (!otp) return next(new AppError('인증번호를 입력해주세요.', 400));

    const record = await prisma.admin_otps.findFirst({
      where: {
        user_id: decoded.id,
        otp: String(otp),
        purpose: 'LOGIN',
        used: false,
        expires_at: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!record) return next(new AppError('인증번호가 올바르지 않거나 만료되었습니다.', 400));

    await prisma.admin_otps.update({
      where: { id: record.id },
      data: { used: true, verified: true },
    });

    const user = await userRepository.findUnique(decoded.id);
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    const { token, refreshToken } = signTokens(user);
    setTokenCookies(res, token, refreshToken);
    res.success({ token, refreshToken, user: safeUser(user) }, '2FA 인증이 완료되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA 활성화 OTP 발송 (인증된 관리자 전용)
 * POST /api/admin/auth/2fa/send-otp
 * Body: { purpose } — "ENABLE" | "DISABLE"
 */
const sendSettingsOtp = async (req, res, next) => {
  try {
    const { purpose } = req.body;
    if (!purpose || !['ENABLE', 'DISABLE'].includes(purpose)) {
      return next(new AppError('purpose는 ENABLE 또는 DISABLE이어야 합니다.', 400));
    }

    const user = await userRepository.findUnique(req.user.id);
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    // 이미 해당 상태인 경우 차단
    if (purpose === 'ENABLE' && user.two_factor_enabled) {
      return next(new AppError('이미 2FA가 활성화되어 있습니다.', 400));
    }
    if (purpose === 'DISABLE' && !user.two_factor_enabled) {
      return next(new AppError('2FA가 이미 비활성화되어 있습니다.', 400));
    }

    // 기존 미사용 OTP 무효화
    await prisma.admin_otps.updateMany({
      where: { user_id: user.id, purpose, used: false },
      data: { used: true },
    });

    const phone = decryptPhone(user.phone);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.admin_otps.create({
      data: { user_id: user.id, otp, purpose, expires_at: expiresAt },
    });

    const label = purpose === 'ENABLE' ? '활성화' : '비활성화';
    await sendSms(phone, `[위마켓] 2FA ${label} 인증번호: ${otp}`);

    const responseData = { message: `2FA ${label} 인증번호가 발송되었습니다.` };
    if (IS_DEV || !process.env.SMS_ENV || process.env.SMS_ENV === 'none') {
      responseData.dev_otp = otp;
    }

    res.success(responseData, `2FA ${label} 인증번호가 발송되었습니다.`);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA 활성화/비활성화 실행 (OTP 검증 후)
 * POST /api/admin/auth/2fa/verify
 * Body: { purpose, otp }
 */
const verifySettingsOtp = async (req, res, next) => {
  try {
    const { purpose, otp } = req.body;
    if (!purpose || !['ENABLE', 'DISABLE'].includes(purpose)) {
      return next(new AppError('purpose는 ENABLE 또는 DISABLE이어야 합니다.', 400));
    }
    if (!otp) return next(new AppError('인증번호를 입력해주세요.', 400));

    const record = await prisma.admin_otps.findFirst({
      where: {
        user_id: req.user.id,
        otp: String(otp),
        purpose,
        used: false,
        expires_at: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!record) return next(new AppError('인증번호가 올바르지 않거나 만료되었습니다.', 400));

    // OTP 사용 처리
    await prisma.admin_otps.update({
      where: { id: record.id },
      data: { used: true, verified: true },
    });

    // 상태 변경
    await userRepository.update(req.user.id, {
      two_factor_enabled: purpose === 'ENABLE',
    });

    const label = purpose === 'ENABLE' ? '활성화' : '비활성화';
    res.success({ two_factor_enabled: purpose === 'ENABLE' }, `2FA가 ${label}되었습니다.`);
  } catch (error) {
    next(error);
  }
};

/**
 * 2FA 활성화 상태 확인
 * GET /api/admin/auth/2fa/status
 */
const getStatus = async (req, res, next) => {
  try {
    const user = await userRepository.findUnique(req.user.id);
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));
    res.success({ two_factor_enabled: user.two_factor_enabled });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendLoginOtp,
  verifyLoginOtp,
  sendSettingsOtp,
  verifySettingsOtp,
  getStatus,
};

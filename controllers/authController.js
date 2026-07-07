const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const { sendSms } = require('../utils/smsService');
const { normalizePhone, encryptPhone, decryptPhone, encryptPhoneForSearch, phoneSearchCandidates } = require('../utils/phoneEncryption');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const IS_DEV = process.env.NODE_ENV !== 'production';

if (!JWT_SECRET && !IS_DEV) {
  logger.error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}


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
 * OTP 발송
 * POST /auth/send-otp { phone }
 */
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return next(new AppError('핸드폰 번호를 입력해주세요.', 400));

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) return next(new AppError('올바른 핸드폰 번호를 입력해주세요.', 400));

    // 기존 미사용 OTP 무효화
    await prisma.phone_otps.updateMany({
      where: { phone: normalized, used: false },
      data: { used: true },
    });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분

    await prisma.phone_otps.create({
      data: { phone: normalized, otp, expires_at: expiresAt },
    });

    await sendSms(normalized, `[위마켓] 인증번호: ${otp}`);

    const responseData = { message: '인증번호가 발송되었습니다.' };
    if (IS_DEV || !process.env.SMS_ENV || process.env.SMS_ENV === 'none') responseData.dev_otp = otp;

    res.success(responseData, '인증번호가 발송되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * OTP 검증
 * POST /auth/verify-otp { phone, otp }
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return next(new AppError('핸드폰 번호와 인증번호를 입력해주세요.', 400));

    const normalized = normalizePhone(phone);
    const record = await prisma.phone_otps.findFirst({
      where: { phone: normalized, used: false, verified: false },
      orderBy: { created_at: 'desc' },
    });

    if (!record) return next(new AppError('인증번호를 다시 요청해주세요.', 400));
    if (new Date() > record.expires_at) return next(new AppError('인증번호가 만료되었습니다. 다시 요청해주세요.', 400));
    if (record.otp !== String(otp)) return next(new AppError('인증번호가 일치하지 않습니다.', 400));

    await prisma.phone_otps.update({
      where: { id: record.id },
      data: { verified: true },
    });

    res.success({ verified: true, phone: normalized }, '인증이 완료되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * 회원가입 (OTP 인증 완료 후)
 * POST /auth/register { phone, password }
 */
const register = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone) return next(new AppError('핸드폰 번호는 필수입니다.', 400));
    if (!password || password.length < 6) return next(new AppError('비밀번호는 최소 6자 이상이어야 합니다.', 400));

    const normalized = normalizePhone(phone);
    const encryptedPhone = encryptPhone(normalized);

    const exists = await prisma.users.findFirst({
      where: { OR: [{ phone: encryptedPhone }, { phone: normalized }] }
    });
    if (exists) return next(new AppError('이미 가입된 핸드폰 번호입니다.', 409));

    // OTP 인증 확인 (BYPASS_OTP=true 환경변수로 건너뛰기 가능)
    if (process.env.BYPASS_OTP !== 'true') {
      const verifiedOtp = await prisma.phone_otps.findFirst({
        where: {
          phone: normalized,
          verified: true,
          used: false,
          expires_at: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        orderBy: { created_at: 'desc' },
      });

      if (!verifiedOtp) {
        return next(new AppError('핸드폰 번호 인증이 필요합니다.', 400));
      }

      // OTP 사용 처리
      await prisma.phone_otps.update({
        where: { id: verifiedOtp.id },
        data: { used: true },
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await prisma.users.create({
      data: {
        phone: encryptedPhone,
        password: hashedPassword,
        role: 'user',
        profile_step: 1,
      },
    });

    const { token, refreshToken } = signTokens(user);
    res.success({ token, refreshToken, user: safeUser(user) }, '회원가입이 완료되었습니다.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 로그인
 * identifier = 핸드폰 번호 또는 이메일
 */
const login = async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body;

    if (!password) return next(new AppError('비밀번호를 입력해주세요.', 400));

    const loginId = (identifier || email || '').trim();
    if (!loginId) return next(new AppError('핸드폰 번호 또는 이메일을 입력해주세요.', 400));

    let user = null;

    if (loginId.includes('@')) {
      // 이메일은 대소문자 무시 + 공백 제거로 조회 (관례상 대소문자 구분 없음)
      user = await prisma.users.findFirst({
        where: { email: { equals: loginId, mode: 'insensitive' } },
      });
    } else {
      const normalizedPhone = normalizePhone(loginId);
      const encryptedPhone  = encryptPhoneForSearch(normalizedPhone);
      // 현행/레거시 암호문 + 평문 후보를 한 번에 검색
      user = await prisma.users.findFirst({ where: { phone: { in: phoneSearchCandidates(normalizedPhone) } } });
      // 레거시/평문 레코드는 현행 방식으로 재암호화 (점진적 마이그레이션)
      if (user && user.phone !== encryptedPhone) {
        await prisma.users.update({ where: { id: user.id }, data: { phone: encryptedPhone } }).catch(() => {});
      }
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return next(new AppError('아이디 또는 비밀번호가 올바르지 않습니다.', 401));
    }

    const { token, refreshToken } = signTokens(user);
    res.success({ token, refreshToken, user: safeUser(user) }, '로그인 성공');
  } catch (error) {
    next(error);
  }
};

/**
 * 내 정보 조회
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        profile_step: true,
        role: true,
        created_at: true,
      },
    });

    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));
    res.success({ ...user, phone: decryptPhone(user.phone) });
  } catch (error) {
    next(error);
  }
};

/**
 * 프로필 업데이트 (name, email, address 중 일부)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, address } = req.body;
    const userId = req.user.id;

    const current = await prisma.users.findUnique({ where: { id: userId } });
    if (!current) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    const updateData = {};
    let nextStep = current.profile_step || 1;

    if (name !== undefined) {
      updateData.name = name;
      if (nextStep < 2) nextStep = 2;
    }

    if (email !== undefined) {
      // 이메일 정규화(trim + 소문자) — 로그인 조회·중복검사 일관성 확보
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      if (normalizedEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return next(new AppError('이메일 형식이 올바르지 않습니다.', 400));
        }
        const dup = await prisma.users.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' }, NOT: { id: userId } },
        });
        if (dup) return next(new AppError('이미 사용 중인 이메일입니다.', 409));
      }
      updateData.email = normalizedEmail;
      if (nextStep < 3) nextStep = 3;
    }

    if (address !== undefined) {
      updateData.address = address;
      if (nextStep < 4) nextStep = 4;
    }

    updateData.profile_step = nextStep;

    const updated = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, name: true, email: true, phone: true,
        address: true, profile_step: true, role: true,
      },
    });

    res.success(updated, '프로필이 업데이트되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * 비밀번호 변경
 * PUT /auth/password
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return next(new AppError('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.', 400));
    }
    if (new_password.length < 6) {
      return next(new AppError('새 비밀번호는 최소 6자 이상이어야 합니다.', 400));
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    if (!bcrypt.compareSync(current_password, user.password)) {
      return next(new AppError('현재 비밀번호가 올바르지 않습니다.', 400));
    }

    const hashed = bcrypt.hashSync(new_password, 10);
    await prisma.users.update({
      where: { id: userId },
      data: { password: hashed },
    });

    res.success(null, '비밀번호가 변경되었습니다.');
  } catch (error) {
    next(error);
  }
};

/**
 * 토큰 갱신
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: clientToken } = req.body;
    if (!clientToken) return next(new AppError('리프레시 토큰이 필요합니다.', 400));

    const decoded = jwt.verify(clientToken, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') return next(new AppError('유효하지 않은 토큰 타입입니다.', 401));

    const user = await prisma.users.findUnique({ where: { id: decoded.id } });
    if (!user) return next(new AppError('사용자를 찾을 수 없습니다.', 404));

    const { token, refreshToken: newRefreshToken } = signTokens(user);
    res.success({ token, refreshToken: newRefreshToken }, '토큰이 갱신되었습니다.');
  } catch {
    return next(new AppError('유효하지 않거나 만료된 리프레시 토큰입니다.', 401));
  }
};

module.exports = { sendOtp, verifyOtp, register, login, getMe, updateProfile, changePassword, refreshToken };

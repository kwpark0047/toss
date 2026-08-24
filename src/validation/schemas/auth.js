/**
 * 인증 관련 Zod 검증 스키마 (body 직접 스키마)
 */

const { z } = require('zod');

// 공통 필드
const emailSchema = z.string().email('유효하지 않은 이메일 형식입니다.').max(255);
const phoneSchema = z.string().regex(/^01[0-9][0-9]{7,8}$/, '유효하지 않은 한국 전화번호 형식입니다. (010-xxxx-xxxx)');
const passwordSchema = z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.').max(128).regex(/[A-Za-z]/, '영문자를 포함해야 합니다.').regex(/[0-9]/, '숫자를 포함해야 합니다.');
const nameSchema = z.string().min(1).max(100).trim();
const businessNumberSchema = z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자등록번호 형식: 123-45-67890');

// 로그인
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력하세요.'),
  rememberMe: z.boolean().optional(),
});

// 회원가입
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  passwordConfirm: z.string(),
  name: nameSchema,
  phone: phoneSchema.optional(),
  businessNumber: businessNumberSchema.optional(),
  storeName: z.string().max(200).optional(),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: '약관에 동의해야 합니다.' }) }),
  agreePrivacy: z.literal(true, { errorMap: () => ({ message: '개인정보 처리에 동의해야 합니다.' }) }),
  agreeMarketing: z.boolean().optional(),
}).refine(data => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['passwordConfirm'],
});

// 관리자 로그인
const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  otp: z.string().length(6, 'OTP는 6자리 숫자입니다.').regex(/^\d{6}$/).optional(),
});

// 비밀번호 재설정 요청
const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

// 비밀번호 재설정 확인
const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, '토큰이 필요합니다.'),
  password: passwordSchema,
  passwordConfirm: z.string(),
}).refine(data => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['passwordConfirm'],
});

// 토큰 갱신
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다.'),
});

// 이메일 인증 코드 발송
const sendVerificationSchema = z.object({
  email: emailSchema,
  type: z.enum(['register', 'reset_password', 'change_email']).optional(),
});

// 이메일 인증 코드 확인
const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().length(6, '인증 코드는 6자리입니다.').regex(/^\d{6}$/),
  type: z.enum(['register', 'reset_password', 'change_email']).optional(),
});

// 전화번호 인증 코드 발송
const sendPhoneVerificationSchema = z.object({
  phone: phoneSchema,
  type: z.enum(['register', 'login', 'change_phone']).optional(),
});

// 전화번호 인증 코드 확인
const verifyPhoneCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, '인증 코드는 6자리입니다.').regex(/^\d{6}$/),
  type: z.enum(['register', 'login', 'change_phone']).optional(),
});

// 소셜 로그인
const socialLoginSchema = z.object({
  provider: z.enum(['kakao', 'naver', 'google']),
  accessToken: z.string().min(1),
  idToken: z.string().optional(),
  fcmToken: z.string().optional(),
});

// 비밀번호 변경 (로그인 상태)
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요.'),
  newPassword: passwordSchema,
  newPasswordConfirm: z.string(),
}).refine(data => data.newPassword === data.newPasswordConfirm, {
  message: '새 비밀번호가 일치하지 않습니다.',
  path: ['newPasswordConfirm'],
});

// 프로필 업데이트
const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  profileImage: z.string().url().optional().nullable(),
}).strict();

module.exports = {
  loginSchema,
  registerSchema,
  adminLoginSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  refreshTokenSchema,
  sendVerificationSchema,
  verifyCodeSchema,
  sendPhoneVerificationSchema,
  verifyPhoneCodeSchema,
  socialLoginSchema,
  changePasswordSchema,
  updateProfileSchema,
  // 공통 스키마 재사용용
  emailSchema,
  phoneSchema,
  passwordSchema,
  nameSchema,
  businessNumberSchema,
};
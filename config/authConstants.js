// [보안] 인증/OTP 관련 공통 상수 (개별 파일의 하드코딩 중복 방지)
// OTP 유효기간: 기본 5분. 환경변수 OTP_EXPIRY_MS(단위: 밀리초)로 오버라이드 가능.
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS) || 5 * 60 * 1000;

module.exports = {
  OTP_EXPIRY_MS,
};

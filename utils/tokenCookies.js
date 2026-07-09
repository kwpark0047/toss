/**
 * HttpOnly Cookie 기반 JWT 전송 유틸리티
 *
 * 사용: process.env.USE_HTTPONLY_COOKIE === 'true' 일 때 활성화
 * 마이그레이션 기간 동안 Authorization 헤더와 이중 지원
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path: '/',
};

function isCookieMode() {
  return process.env.USE_HTTPONLY_COOKIE === 'true';
}

/**
 * 응답에 access/refresh token 쿠키 설정
 */
function setTokenCookies(res, token, refreshToken) {
  if (!isCookieMode()) return;

  res.cookie('token', token, {
    ...COOKIE_OPTIONS,
    maxAge: 2 * 60 * 60 * 1000, // 2h
  });

  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
}

/**
 * 응답에서 토큰 쿠키 제거 (로그아웃)
 */
function clearTokenCookies(res) {
  if (!isCookieMode()) return;

  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth' });
}

module.exports = { setTokenCookies, clearTokenCookies, isCookieMode };

/**
 * HttpOnly Cookie 기반 JWT 전송 유틸리티 (H-2)
 *
 * [배경]
 * 토큰을 localStorage 에 저장하면 XSS 1건으로 전 계정이 탈취된다.
 * HttpOnly Cookie 로 옮기면 JS 로 토큰을 읽을 수 없어 탈취 표면이 사라진다.
 *
 * [전환 방식]
 * process.env.USE_HTTPONLY_COOKIE === 'true' 일 때 활성화.
 * 마이그레이션 기간 동안 Authorization 헤더(localStorage) 경로와 이중 지원한다.
 *
 * [중요: cross-site 쿠키]
 * 프론트(예: toss.wemarket.workers.dev) 와 백엔드(예: wemarket-toss.onrender.com)
 * 가 **다른 사이트**다. 이때 sameSite 가 'strict' 나 'lax' 이면 브라우저가
 * 쿠키를 전송하지 않아 로그인이 풀린다. cross-site HttpOnly 쿠키는 반드시
 *   SameSite=None + Secure
 * 조합이어야 한다. (secure 가 없으면 SameSite=None 은 브라우저가 거부한다)
 *
 * [쿠키 경로]
 * refreshToken 은 /api/auth 아래로만 본낸다(access token 노출 최소화).
 * 이전 코드는 '/auth' 로 잡혀 있어 실제 라우트(/api/auth/refresh-token)와
 * 불일치하여 쿠키가 전송되지 않는 버그가 있었다.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

// 쿠키 모드에서 프론트/백엔드가 cross-site 로 운영되는지 여부.
// 배포 형태가 둘 다 다른 도메인이므로 기본값은 true 이고,
// reverse proxy 로 동일 사이트에 모은 경우 USE_HTTPONLY_COOKIE_SAME_SITE=lax 로 내릴 수 있다.
const CROSS_SITE = process.env.COOKIE_CROSS_SITE !== 'false';

function buildCookieOptions() {
  if (CROSS_SITE) {
    // cross-site 는 HTTPS(Secure)가 필수이므로 개발 환경에서도 쿠키가 필요하면
    // same-site(dev 프록시)로 두거나, HTTPS 로컬 환경을 사용한다.
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    };
  }
  // same-site (동일 도메인 reverse proxy 또는 개발) — Strict는 리다이렉트 시 쿠키 누락을
  // 유발할 수 있어 Lax 를 기본으로 한다.
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'lax' : 'lax',
    path: '/',
  };
}

const COOKIE_OPTIONS = buildCookieOptions();

/** 백엔드 API 의 인증 경로 프리픽스. app.js 에서 /api/auth 에 마운트된다. */
const AUTH_COOKIE_PATH = '/api/auth';

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
    path: AUTH_COOKIE_PATH,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
}

/**
 * 응답에서 토큰 쿠키 제거 (로그아웃)
 */
function clearTokenCookies(res) {
  if (!isCookieMode()) return;

  // clearCookie 는 설정 당시와 동일한 옵션(path/sameSite/secure)을 맞춰야 삭제된다.
  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: AUTH_COOKIE_PATH });
}

module.exports = { setTokenCookies, clearTokenCookies, isCookieMode, AUTH_COOKIE_PATH };

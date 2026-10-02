/**
 * CSRF 방어 미들웨어 (double-submit cookie)
 *
 * [왜 필요한가]
 * HttpOnly 쿠키 인증(`SameSite=None; Secure`)을 쓰면 브라우저가 인증 쿠키를
 * 자동으로 첨부한다. `SameSite` 로는 막을 수 없으므로, 출처를 모르는 사이트가
 * 만든 요청도 서버 입장에서 정상 요청과 구분되지 않는다.
 * CORS 는 *응답 읽기*만 제한할 뿐 *요청 전송* 자체는 막지 못하므로
 * cors 설정만으로는 CSRF 가 방어되지 않는다.
 *
 * [동작]
 * 1. `USE_HTTPONLY_COOKIE=true` 일 때만 동작한다.
 *    - `Authorization: Bearer` 헤더 경로는 브라우저가 자동으로 첨부하지 못하므로
 *      CSRF 노출이 없어 통과시킨다. (헤더 경로는 이 미들웨어의 대상이 아니다)
 * 2. 안전한 메서드(GET/HEAD/OPTIONS)와 서버 간 호출 경로는 제외한다.
 * 3. CSRF 토큰 쿠키(`csrfToken`)가 없으면 발급한다. httpOnly:false 이므로
 *    프런트에서 `X-CSRF-Token` 헤더로 되돌려 보낸다.
 * 4. 변경 메서드에서 헤더와 쿠키 값이 일치해야만 통과한다. 없거나 다르면 403.
 *
 * [프런트/백엔드 도메인이 다른 경우]
 * 프런트(vercel.app) JS 는 API(render.com) 도메인의 쿠키를 `document.cookie`
 * 로 읽을 수 없다. 그래서 프런트는 `GET /api/auth/csrf-token` 으로 토큰 값을
 * 받아 메모리에 보관한 뒤 헤더로 붙이고, 서버는 그 값을 쿠키와 비교한다.
 *
 * [주의]
 * - 프런트는 state-changing 요청에 `X-CSRF-Token` 헤더를 붙여야 한다.
 * - CORS `allowedHeaders` 에 'X-CSRF-Token' 이 포함되어 있어야 preflight 가 통과한다.
 */

const crypto = require('crypto');
const { isCookieMode } = require('../utils/tokenCookies');

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// 서버 간 호출(Toss 웹훅)·헬스체크·메트릭은 쿠키를 갖지 않으므로 제외한다.
const EXEMPT_PATHS = [
  // 주의: 토스 웹훅 실제 경로는 /api/payments/webhooks/toss 이다.
  // payments 라우터가 /api/payments 에 마운트되므로 (routes/payments.js:366)
  // /api/webhooks 로 가정하면 웹훅이 403 차단되어 결제가 유실된다.
  /^\/api\/payments\/webhooks(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/health(\/|$)/,
  /^\/health(\/|$)/,
  /^\/metrics(\/|$)/,
];

const isExemptPath = (path) => EXEMPT_PATHS.some((pattern) => pattern.test(path));

/**
 * 길이가 다르면 timingSafeEqual 이 예외를 던지므로 먼저 길이를 비교한다.
 * (길이 자체는 비밀이 아니므로 상수시간 비교 불필요)
 */
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const buildCookieOptions = () => {
  // 프런트/백엔드가 다른 도메인이라 cross-site 쿠키는 SameSite=None + Secure 가 필수다.
  // utils/tokenCookies.js 와 동일한 판정식을 사용한다.
  const crossSite = process.env.COOKIE_CROSS_SITE !== 'false';
  return {
    httpOnly: false,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
  };
};

/**
 * 요청의 CSRF 토큰을 해석하고, 없으면 새로 발급해 쿠키로 내려준다.
 * 안전한 메서드에서도 호출해 첫 변경 요청이 막히지 않게 한다.
 * @returns {string} 토큰 값
 */
const ensureCsrfToken = (req, res) => {
  // 미들웨어가 이미 해석/발급했다면 그 값을 재사용한다.
  // 새로 발급하면 같은 이름의 Set-Cookie 가 두 번 나가 토큰이 어긋날 수 있다.
  if (req.csrfToken) return req.csrfToken;

  let token = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : undefined;

  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    if (typeof res.cookie === 'function') {
      res.cookie(CSRF_COOKIE_NAME, token, buildCookieOptions());
    }
  }

  req.csrfToken = token;
  return token;
};

const csrfProtection = (req, res, next) => {
  if (!isCookieMode()) return next();

  const path = req.path || '';

  if (isExemptPath(path)) return next();

  const token = ensureCsrfToken(req, res);

  if (SAFE_METHODS.has(req.method)) return next();

  const sent =
    typeof req.get === 'function' ? req.get(CSRF_HEADER_NAME) : req.headers?.[CSRF_HEADER_NAME];

  if (!sent || !safeEqual(sent, token)) {
    return res.status(403).json({
      error: 'CSRF 검증에 실패했습니다. 페이지를 새로 고친 후 다시 시도해 주세요.',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  return next();
};

module.exports = {
  csrfProtection,
  ensureCsrfToken,
  buildCookieOptions,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};

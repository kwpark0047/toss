/**
 * CSRF 토큰 관리 (쿠키 인증 모드 전용)
 *
 * [왜 토큰을 메모리에 보관하는가]
 * 프런트(vercel.app)와 API(render.com)가 다른 도메인이다. 브라우저의
 * `document.cookie` 는 현재 도메인의 쿠키만 읽으므로 API 가 내려준
 * csrfToken 쿠키를 프런트 JS 가 직접 읽을 수 없다.
 *
 * 그래서 서버가 `GET /api/auth/csrf-token` 으로 토큰 값을 응답 본문에 담아주고,
 * 프런트는 그 값을 메모리에 보관해 변경 요청마다 `X-CSRF-Token` 헤더로
 * 되돌려 보낸다. 서버는 이 값을 쿠키와 비교한다(double-submit).
 *
 * [보안考量]
 * 토큰을 localStorage 에 영구 저장하지 않는다. 탭을 닫으면 사라지고,
 * XSS 로 localStorage 가 털려도 세션 쿠키까지 함께 얻어야 의미가 있다.
 * 메모리 캐시이므로 페이지 새로 고침 시 1회만 재발급 받으면 된다.
 */

const SAFE_METHODS = new Set(['get', 'head', 'options']);

// 이 엔드포인트 자체에는 헤더를 붙일 필요가 없다(안전한 메서드).
const TOKEN_PATH = '/auth/csrf-token';

let cachedToken = null;
let inflight = null;

/** 테스트용: 메모리 캐시 초기화 */
export const __resetCsrfToken = () => {
  cachedToken = null;
  inflight = null;
};

/** 현재 캐시된 토큰 (없으면 null) */
export const getCachedCsrfToken = () => cachedToken;

/**
 * CSRF 토큰을 확보한다. 캐시된 값이 있으면 즉시 반환하고,
 * 없으면 서버에서 1회만 받아 동시 호출을 합친다(single-flight).
 *
 * @param {string} apiUrl - baseURL (예: https://host/api)
 * @returns {Promise<string|null>} 토큰. 실패하면 null 을 반환한다.
 */
export const fetchCsrfToken = async (apiUrl) => {
  if (cachedToken) return cachedToken;
  if (inflight) return inflight;

  const url = `${apiUrl.replace(/\/$/, '')}${TOKEN_PATH}`;

  inflight = fetch(url, {
    method: 'GET',
    // 쿠키를 보내야 서버가 기존 csrfToken 을 재사용할 수 있다
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`CSRF 토큰 요청 실패: ${res.status}`);
      const body = await res.json();
      // 응답 포맷터가 { success, data } 로 감싸는 구조를 모두 대응한다.
      const token = body?.data?.csrfToken ?? body?.csrfToken;
      if (!token) throw new Error('CSRF 토큰 응답에 csrfToken 이 없다');
      cachedToken = token;
      return token;
    })
    .catch((err) => {
      // 실패해도 앱 전체를 죽이지 않는다. 서버가 CSRF 를 끈 모드일 수 있다.
      console.warn('[wemarket/csrf] 토큰 획득 실패:', err?.message);
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

/**
 * axios 요청 인터셉터에 쓸 attaches 함수.
 * 변경 메서드에 대해서만 토큰을 붙이고, 안전한 메서드는 건드리지 않는다.
 *
 * @param {object} config - axios 요청 설정
 * @param {string} apiUrl - baseURL
 * @returns {Promise<object>} 설정이 끝난 config
 */
export const attachCsrfToken = async (config, apiUrl) => {
  const method = (config.method || 'get').toLowerCase();
  if (SAFE_METHODS.has(method)) return config;

  // 헤더가 이미 있으면(재시도 등) 덮어쓰지 않는다
  if (config.headers?.['X-CSRF-Token']) return config;

  const token = await fetchCsrfToken(apiUrl);
  if (token) {
    config.headers = config.headers || {};
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
};

/**
 * 403 CSRF_TOKEN_INVALID 를 1회 재시도한다.
 * 서버가 토큰을 회전시킨 경우(쿠키 만료/재발급)에 복구하기 위한 안전망.
 * 실제 요청을 다시 보내기 전에 토큰을 강제로 재발급받는다.
 *
 * @param {object} originalRequest - 실패한 axios 요청 설정
 * @returns {boolean} 재시도 대상이면 true
 */
export const shouldRetryWithFreshToken = (error) => {
  const original = error?.config;
  if (!original) return false;
  if (original._csrfRetried) return false;
  if (error?.response?.status !== 403) return false;
  if (error?.response?.data?.code !== 'CSRF_TOKEN_INVALID') return false;

  const method = (original.method || 'get').toLowerCase();
  if (SAFE_METHODS.has(method)) return false;

  original._csrfRetried = true;
  cachedToken = null;
  inflight = null;
  return true;
};

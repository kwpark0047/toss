/**
 * utils/tokenCookies 테스트 (H-2)
 *
 * [배경]
 *  1. 프론트(workers.dev) 와 백엔드(onrender.com) 가 cross-site 인데
 *     sameSite 'strict'/'lax' 로 설정되어 쿠키가 전송되지 않는 결함이 있었다.
 *  2. refreshToken 쿠키 경로가 '/auth' 여서 실제 라우트('/api/auth')와
 *     불일치해 쿠키가 전송되지 않는 결함이 있었다.
 *  3. 로그아웃 엔드포인트가 없어 쿠키 모드에서 로그아웃이 불가능했다.
 */
describe('utils/tokenCookies', () => {
  const ORIGINAL_ENV = { ...process.env };

  function load(env = {}) {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, ...env };
    return require('../../../utils/tokenCookies');
  }

  function makeRes() {
    const res = {
      cookies: {},
      cleared: {},
      cookie(name, value, options) {
        this.cookies[name] = { value, options };
        return this;
      },
      clearCookie(name, options) {
        this.cleared[name] = options;
        return this;
      },
    };
    return res;
  }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  describe('cross-site 쿠키 옵션', () => {
    test('[핵심] cross-site 운영에서는 SameSite=None + Secure 여야 한다', () => {
      const tc = load({ USE_HTTPONLY_COOKIE: 'true', NODE_ENV: 'production' });
      const res = makeRes();
      tc.setTokenCookies(res, 'tok', 'ref');

      expect(res.cookies.token.options.sameSite).toBe('none');
      expect(res.cookies.token.options.secure).toBe(true);
      expect(res.cookies.token.options.httpOnly).toBe(true);
    });

    test('refreshToken 쿠키는 /api/auth 경로로 제한된다', () => {
      const tc = load({ USE_HTTPONLY_COOKIE: 'true', NODE_ENV: 'production' });
      const res = makeRes();
      tc.setTokenCookies(res, 'tok', 'ref');

      expect(res.cookies.refreshToken.options.path).toBe('/api/auth');
      expect(res.cookies.token.options.path).toBe('/');
    });

    test('same-site 배포(COOKIE_CROSS_SITE=false)에서는 Lax 로 낮출 수 있다', () => {
      const tc = load({
        USE_HTTPONLY_COOKIE: 'true',
        NODE_ENV: 'production',
        COOKIE_CROSS_SITE: 'false',
      });
      const res = makeRes();
      tc.setTokenCookies(res, 'tok', 'ref');

      expect(res.cookies.token.options.sameSite).toBe('lax');
      expect(res.cookies.token.options.httpOnly).toBe(true);
    });
  });

  describe('모드 분기', () => {
    test('USE_HTTPONLY_COOKIE 가 꺼져 있으면 쿠키를 설정하지 않는다', () => {
      const tc = load({ USE_HTTPONLY_COOKIE: 'false' });
      const res = makeRes();
      tc.setTokenCookies(res, 'tok', 'ref');
      expect(Object.keys(res.cookies)).toHaveLength(0);
    });

    test('isCookieMode 는 플래그를 그대로 반영한다', () => {
      expect(load({ USE_HTTPONLY_COOKIE: 'true' }).isCookieMode()).toBe(true);
      expect(load({ USE_HTTPONLY_COOKIE: 'false' }).isCookieMode()).toBe(false);
    });
  });

  describe('로그아웃', () => {
    test('clearTokenCookies 는 설정 시와 같은 경로로 제거한다', () => {
      const tc = load({ USE_HTTPONLY_COOKIE: 'true', NODE_ENV: 'production' });
      const res = makeRes();
      tc.clearTokenCookies(res);

      expect(res.cleared.token.path).toBe('/');
      expect(res.cleared.refreshToken.path).toBe('/api/auth');
    });

    test('쿠키 모드가 아니면 제거하지 않는다', () => {
      const tc = load({ USE_HTTPONLY_COOKIE: 'false' });
      const res = makeRes();
      tc.clearTokenCookies(res);
      expect(Object.keys(res.cleared)).toHaveLength(0);
    });
  });
});

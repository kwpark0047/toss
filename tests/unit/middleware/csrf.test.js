/**
 * CSRF double-submit 미들웨어 테스트
 *
 * HttpOnly 쿠키(SameSite=None) 인증 경로에서 출처를 모르는 요청이
 * state-changing 작업을 수행하지 못하도록 막는지 검증한다.
 */
const {
  csrfProtection,
  ensureCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} = require('../../../middleware/csrf');

/** 최소한의 req/res 스텁 */
function makeReq({ method = 'GET', path = '/api/orders', cookies = {}, headers = {} } = {}) {
  return {
    method,
    path,
    cookies,
    headers: { [CSRF_HEADER_NAME]: '', ...headers },
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
  };
}

const COOKIE_MODE = 'true';

describe('middleware/csrf — csrfProtection', () => {
  const original = process.env.USE_HTTPONLY_COOKIE;
  const originalCrossSite = process.env.COOKIE_CROSS_SITE;

  afterEach(() => {
    if (original === undefined) delete process.env.USE_HTTPONLY_COOKIE;
    else process.env.USE_HTTPONLY_COOKIE = original;
    if (originalCrossSite === undefined) delete process.env.COOKIE_CROSS_SITE;
    else process.env.COOKIE_CROSS_SITE = originalCrossSite;
  });

  describe('헤더 인증 경로 (현재 운영 설정)', () => {
    beforeEach(() => {
      delete process.env.USE_HTTPONLY_COOKIE;
    });

    it('USE_HTTPONLY_COOKIE 미설정 시 변경 메서드도 그대로 통과한다', () => {
      const req = makeReq({ method: 'POST' });
      const res = makeRes();
      const next = jest.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.cookies).toHaveLength(0);
    });

    it('헤더 경로에서는 CSRF 토큰 쿠키를 발급하지 않는다', () => {
      const res = makeRes();
      csrfProtection(makeReq({ method: 'GET' }), res, jest.fn());
      expect(res.cookies).toHaveLength(0);
    });
  });

  describe('쿠키 인증 경로 — 토큰 발급', () => {
    beforeEach(() => {
      process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    });

    it('토큰 쿠키가 없으면 발급한다', () => {
      const res = makeRes();
      csrfProtection(makeReq({ method: 'GET' }), res, jest.fn());

      expect(res.cookies).toHaveLength(1);
      expect(res.cookies[0].name).toBe(CSRF_COOKIE_NAME);
      expect(res.cookies[0].value).toMatch(/^[0-9a-f]{64}$/);
    });

    it('발급한 쿠키는 프런트가 읽을 수 있어야 하므로 httpOnly 가 false 다', () => {
      const res = makeRes();
      csrfProtection(makeReq({ method: 'GET' }), res, jest.fn());
      expect(res.cookies[0].options.httpOnly).toBe(false);
    });

    it('cross-site 기본값은 SameSite=None + Secure 다', () => {
      delete process.env.COOKIE_CROSS_SITE;
      const res = makeRes();
      csrfProtection(makeReq({ method: 'GET' }), res, jest.fn());
      expect(res.cookies[0].options.sameSite).toBe('none');
      expect(res.cookies[0].options.secure).toBe(true);
    });

    it('COOKIE_CROSS_SITE=false 이면 Lax 로 낮춘다', () => {
      process.env.COOKIE_CROSS_SITE = 'false';
      const res = makeRes();
      csrfProtection(makeReq({ method: 'GET' }), res, jest.fn());
      expect(res.cookies[0].options.sameSite).toBe('lax');
      expect(res.cookies[0].options.secure).toBe(false);
    });

    it('이미 토큰 쿠키가 있으면 새로 발급하지 않는다', () => {
      const res = makeRes();
      csrfProtection(
        makeReq({ method: 'GET', cookies: { [CSRF_COOKIE_NAME]: 'existing' } }),
        res,
        jest.fn()
      );
      expect(res.cookies).toHaveLength(0);
    });
  });

  describe('쿠키 인증 경로 — 안전한 메서드는 통과', () => {
    beforeEach(() => {
      process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])('%s 는 검증 없이 통과한다', (method) => {
      const next = jest.fn();
      const res = makeRes();
      csrfProtection(makeReq({ method }), res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('쿠키 인증 경로 — 예외 경로', () => {
    beforeEach(() => {
      process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    });

    it.each([
      ['Toss 웹훅 (실제 경로)', '/api/payments/webhooks/toss'],
      ['레거시 웹훅 경로', '/api/webhooks/toss'],
      ['웹훅 루트', '/api/webhooks'],
      ['헬스체크', '/api/health'],
      ['메트릭', '/metrics'],
    ])('%s (%s) 은 헤더 없이도 통과한다', (_label, path) => {
      const next = jest.fn();
      const res = makeRes();
      csrfProtection(makeReq({ method: 'POST', path }), res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });

    it('Toss 웹훅은 쿠키 토큰이 있어도 강제 검증하지 않는다', () => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(
        makeReq({
          method: 'POST',
          path: '/api/payments/webhooks/toss',
          cookies: { [CSRF_COOKIE_NAME]: 'a'.repeat(64) },
        }),
        res,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('쿠키 인증 경로 — 변경 메서드는 검증한다', () => {
    const TOKEN = 'a'.repeat(64);

    beforeEach(() => {
      process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s 는 헤더가 없으면 403 이다', (method) => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(makeReq({ method, cookies: { [CSRF_COOKIE_NAME]: TOKEN } }), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('헤더 값이 다르면 403 이다', () => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(
        makeReq({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: TOKEN },
          headers: { [CSRF_HEADER_NAME]: 'b'.repeat(64) },
        }),
        res,
        next
      );

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('길이가 다른 헤더는 예외 없이 403 이다 (timingSafeEqual 가드)', () => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(
        makeReq({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: TOKEN },
          headers: { [CSRF_HEADER_NAME]: 'short' },
        }),
        res,
        next
      );

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('쿠키와 헤더가 일치하면 통과한다', () => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(
        makeReq({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: TOKEN },
          headers: { [CSRF_HEADER_NAME]: TOKEN },
        }),
        res,
        next
      );

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });

    it('첫 요청이라 쿠키가 없으면 발급하면서 403 이다 (fail-closed)', () => {
      const res = makeRes();
      const next = jest.fn();
      csrfProtection(makeReq({ method: 'POST' }), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.cookies).toHaveLength(1);
    });

    it('req.cookies 가 비어 있어도 예외 없이 동작한다', () => {
      const req = makeReq({ method: 'POST' });
      req.cookies = undefined;
      const res = makeRes();
      expect(() => csrfProtection(req, res, jest.fn())).not.toThrow();
      expect(res.statusCode).toBe(403);
    });
  });
});

describe('middleware/csrf — ensureCsrfToken', () => {
  const originalCrossSite = process.env.COOKIE_CROSS_SITE;

  afterEach(() => {
    if (originalCrossSite === undefined) delete process.env.COOKIE_CROSS_SITE;
    else process.env.COOKIE_CROSS_SITE = originalCrossSite;
  });

  // 미들웨어가 이미 토큰을 발급한 뒤 라우트가 다시 호출하면 같은 이름의
  // Set-Cookie 가 두 번 나가고 프런트/서버가 서로 다른 토큰을 갖게 된다.
  it('미들웨어가 req.csrfToken 에 남긴 값을 재사용해 쿠키를 중복 발급하지 않는다', () => {
    const req = makeReq({ cookies: {} });
    const res = makeRes();

    req.csrfToken = 'already-issued';
    const token = ensureCsrfToken(req, res);

    expect(token).toBe('already-issued');
    expect(res.cookies).toHaveLength(0);
  });

  it('토큰이 없으면 새로 발급하고 쿠키에 심는다', () => {
    const req = makeReq({ cookies: {} });
    const res = makeRes();

    const token = ensureCsrfToken(req, res);

    expect(token).toHaveLength(64); // randomBytes(32).toString('hex')
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0].name).toBe(CSRF_COOKIE_NAME);
    expect(res.cookies[0].value).toBe(token);
  });

  it('발급한 토큰을 req 에 캐시해 이후 호출에서 재생성하지 않는다', () => {
    const req = makeReq({ cookies: {} });
    const res = makeRes();

    const first = ensureCsrfToken(req, res);
    const second = ensureCsrfToken(req, res);

    expect(second).toBe(first);
    expect(res.cookies).toHaveLength(1);
  });

  it('기존 쿠키가 있으면 그 값을 그대로 사용한다', () => {
    const req = makeReq({ cookies: { [CSRF_COOKIE_NAME]: 'from-cookie' } });
    const res = makeRes();

    expect(ensureCsrfToken(req, res)).toBe('from-cookie');
    expect(res.cookies).toHaveLength(0);
  });

  it('cross-site 쿠키는 SameSite=None + Secure 로 설정한다', () => {
    delete process.env.COOKIE_CROSS_SITE;
    const res = makeRes();

    ensureCsrfToken(makeReq({ cookies: {} }), res);

    expect(res.cookies[0].options).toMatchObject({
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
  });

  // 프런트 JS 가 document.cookie 로 읽어야 하므로 httpOnly 로 막으면 안 된다.
  it('프런트가 읽을 수 있도록 httpOnly 는 false 다', () => {
    const res = makeRes();

    ensureCsrfToken(makeReq({ cookies: {} }), res);

    expect(res.cookies[0].options.httpOnly).toBe(false);
  });
});

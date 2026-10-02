/**
 * GET /api/auth/csrf-token 라우트 테스트
 *
 * 프런트(vercel.app)와 API(render.com)가 다른 도메인이므로 프런트 JS 는
 * csrfToken 쿠키를 document.cookie 로 읽을 수 없다. 이 라우트가 토큰 값을
 * 응답 본문으로 돌려주는 것이 double-submit 을 성립시키는 전제다.
 */
jest.mock('../../../controllers/authController', () => ({
  login: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  getMe: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const authRouter = require('../../../routes/auth');
const { csrfProtection, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } = require('../../../middleware/csrf');

const COOKIE_MODE = 'true';

describe('routes/auth — GET /api/auth/csrf-token', () => {
  const original = process.env.USE_HTTPONLY_COOKIE;

  const buildApp = () => {
    const app = express();
    app.use((req, res, next) => {
      req.cookies = { ...(req.cookies || {}) };
      res.success = (data) => res.status(200).json({ success: true, data });
      next();
    });
    // 실제 app.mts 와 동일하게 cookieParser → csrfProtection 순서
    app.use((req, res, next) => {
      const header = req.headers.cookie || '';
      req.cookies = {};
      header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx > 0) {
          req.cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
        }
      });
      res.cookie = (name, value, opts) =>
        res.append('Set-Cookie', `${name}=${value}; Path=${opts.path}`);
      next();
    });
    app.use(csrfProtection);
    app.use('/api/auth', authRouter);
    return app;
  };

  afterEach(() => {
    if (original === undefined) delete process.env.USE_HTTPONLY_COOKIE;
    else process.env.USE_HTTPONLY_COOKIE = original;
  });

  it('토큰을 본문으로 돌려주고 csrfToken 쿠키를 함께 설정한다', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;

    const res = await request(buildApp()).get('/api/auth/csrf-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.csrfToken).toBe('string');
    expect(res.body.data.csrfToken).toHaveLength(64);
    expect(res.headers['set-cookie'].join(';')).toContain(CSRF_COOKIE_NAME);
  });

  // 미들웨어가 이미 토큰을 발급하므로 Set-Cookie 가 중복되면 안 된다.
  it('Set-Cookie 가 중복으로 나가지 않는다', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;

    const res = await request(buildApp()).get('/api/auth/csrf-token');

    const csrfCookies = (res.headers['set-cookie'] || []).filter((c) =>
      c.startsWith(`${CSRF_COOKIE_NAME}=`)
    );
    expect(csrfCookies).toHaveLength(1);
  });

  it('기존 쿠키가 있으면 그 토큰을 그대로 반환한다', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;

    const res = await request(buildApp())
      .get('/api/auth/csrf-token')
      .set('Cookie', `${CSRF_COOKIE_NAME}=sticky-token`);

    expect(res.body.data.csrfToken).toBe('sticky-token');
  });

  // 로그인 자체가 변경 요청이므로 인증 없이 토큰을 받아야 한다.
  it('인증 없이 접근할 수 있다', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;

    const res = await request(buildApp()).get('/api/auth/csrf-token');

    expect(res.status).toBe(200);
  });

  it('쿠키 모드가 아니어도 404 가 아니다 (라우트는 항상 존재한다)', async () => {
    delete process.env.USE_HTTPONLY_COOKIE;

    const res = await request(buildApp()).get('/api/auth/csrf-token');

    expect(res.status).toBe(200);
  });

  // 라우터에 실수로 authMiddleware 가 붙으면 로그인이 불가능해진다.
  it('다른 auth 라우트에는 영향이 없고 라우터가 정상 로드된다', () => {
    expect(typeof authRouter).toBe('function');
    const paths = authRouter.stack.map((l) => l.route?.path).filter(Boolean);
    expect(paths).toContain('/csrf-token');
    expect(paths).toContain('/refresh-token');
  });

  it('반환된 토큰으로 변경 메서드 요청이 통과한다 (end-to-end)', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    const app = buildApp();
    app.post('/api/probe', (req, res) => res.json({ ok: true }));

    const issued = await request(app).get('/api/auth/csrf-token');
    const token = issued.body.data.csrfToken;

    const okRes = await request(app)
      .post('/api/probe')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
      .set(CSRF_HEADER_NAME, token);

    expect(okRes.status).toBe(200);
  });

  it('헤더가 없거나 다르면 403 이다', async () => {
    process.env.USE_HTTPONLY_COOKIE = COOKIE_MODE;
    const app = buildApp();
    app.post('/api/probe', (req, res) => res.json({ ok: true }));

    const issued = await request(app).get('/api/auth/csrf-token');
    const token = issued.body.data.csrfToken;

    const missing = await request(app)
      .post('/api/probe')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`);
    expect(missing.status).toBe(403);

    const mismatch = await request(app)
      .post('/api/probe')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${token}`)
      .set(CSRF_HEADER_NAME, 'wrong-token');
    expect(mismatch.status).toBe(403);
  });
});

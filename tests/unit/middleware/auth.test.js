const jwt = require('jsonwebtoken');
const { isCookieMode } = require('../../../utils/tokenCookies');

jest.mock('jsonwebtoken');
jest.mock('../../../utils/tokenCookies');
jest.mock('../../../utils/logger');

process.env.JWT_SECRET = 'test-secret';

const auth = require('../../../middleware/auth');

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { cookies: {}, headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('authMiddleware', () => {
    test('returns 401 when no token provided (no cookie, no Authorization header)', () => {
      isCookieMode.mockReturnValue(false);

      auth.authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '인증 토큰이 필요합니다.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('extracts token from Authorization header and calls next()', () => {
      isCookieMode.mockReturnValue(false);
      const decoded = { id: 1, role: 'owner', name: '장사장' };
      jwt.verify.mockReturnValue(decoded);
      req.headers.authorization = 'Bearer valid-jwt-token';

      auth.authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token', 'test-secret');
      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    test('extracts token from cookie when isCookieMode is true', () => {
      isCookieMode.mockReturnValue(true);
      const decoded = { id: 2, role: 'staff' };
      jwt.verify.mockReturnValue(decoded);
      req.cookies.token = 'cookie-jwt-token';

      auth.authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-jwt-token', 'test-secret');
      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    test('returns 401 when token type is refresh', () => {
      isCookieMode.mockReturnValue(false);
      jwt.verify.mockReturnValue({ type: 'refresh' });
      req.headers.authorization = 'Bearer refresh-token';

      auth.authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '액세스 토큰이 필요합니다.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 with TOKEN_EXPIRED when token is expired', () => {
      isCookieMode.mockReturnValue(false);
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => { throw err; });
      req.headers.authorization = 'Bearer expired-token';

      auth.authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: '토큰이 만료되었습니다.',
        code: 'TOKEN_EXPIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is invalid (generic JWT error)', () => {
      isCookieMode.mockReturnValue(false);
      jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });
      req.headers.authorization = 'Bearer bad-token';

      auth.authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '유효하지 않은 토큰입니다.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when Authorization header is malformed (not Bearer)', () => {
      isCookieMode.mockReturnValue(false);
      req.headers.authorization = 'Token abc123';

      auth.authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: '인증 토큰이 필요합니다.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('prefers cookie over Authorization header when isCookieMode is true', () => {
      isCookieMode.mockReturnValue(true);
      const decoded = { id: 3, role: 'super_admin' };
      jwt.verify.mockReturnValue(decoded);
      req.cookies.token = 'cookie-token';
      req.headers.authorization = 'Bearer header-token';

      auth.authMiddleware(req, res, next);

      // Should have used the cookie value, not the header value
      expect(jwt.verify).toHaveBeenCalledWith('cookie-token', 'test-secret');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('calls next() when no token present', () => {
      isCookieMode.mockReturnValue(false);

      auth.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('sets req.user with valid token', () => {
      isCookieMode.mockReturnValue(false);
      const decoded = { id: 1, role: 'owner' };
      jwt.verify.mockReturnValue(decoded);
      req.headers.authorization = 'Bearer valid-token';

      auth.optionalAuth(req, res, next);

      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    test('skips setting req.user when token is refresh type', () => {
      isCookieMode.mockReturnValue(false);
      jwt.verify.mockReturnValue({ type: 'refresh' });
      req.headers.authorization = 'Bearer refresh-token';

      auth.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('silently ignores invalid/expired token and calls next()', () => {
      isCookieMode.mockReturnValue(false);
      jwt.verify.mockImplementation(() => { throw new Error('bad token'); });
      req.headers.authorization = 'Bearer bad-token';

      auth.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('extracts token from cookie when isCookieMode is true', () => {
      isCookieMode.mockReturnValue(true);
      const decoded = { id: 5, role: 'staff' };
      jwt.verify.mockReturnValue(decoded);
      req.cookies.token = 'cookie-token';

      auth.optionalAuth(req, res, next);

      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('adminOnly', () => {
    test('calls next() when user role is super_admin', () => {
      req.user = { role: 'super_admin' };

      auth.adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 403 when user role is owner', () => {
      req.user = { role: 'owner' };

      auth.adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: '관리자 권한이 필요합니다.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when user role is staff', () => {
      req.user = { role: 'staff' };

      auth.adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when user role is user', () => {
      req.user = { role: 'user' };

      auth.adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when req.user is not set', () => {
      auth.adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

/**
 * 실제 jsonwebtoken(비-목업)으로 JWT algorithm 고정(algorithms: ['HS256'])이
 * 실제로 동작하는지 검증한다.
 *
 * auth.test.js 는 jsonwebtoken 을 통째로 mock 하므로 algorithm 검증 행위를
 * 확인할 수 없다. 여기서는 진짜 서명/검증을 사용한다.
 *
 *  1) HS256 기존 토큰이 통과하는가           → 회귀 없음 확인
 *  2) 같은 secret 으로 만든 HS384/HS512 토큰이 거부되는가 → 알고리즘 혼동 방어
 *  3) alg=none(서명 없는) 토큰이 거부되는가  → unsigned 토큰 방어
 *
 * issuer/audience 는 검증에 넣지 않는다. 현재 모든 sign site 에 iss/aud 가 없고,
 * verify 에만 추가하면 발급된 모든 기존 토큰이 실패해 전 사용자 로그아웃이 되기 때문.
 * 관련 내용은 Risk Analysis 참고.
 */
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-algorithms';
// cookie 경로를 쓰지 않고 Authorization 헤더 경로로 검증한다.
delete process.env.USE_HTTPONLY_COOKIE;

jest.mock('../../../utils/logger');

const auth = require('../../../middleware/auth');

const signWith = (payload, algorithm) =>
  algorithm === 'none'
    ? jwt.sign(payload, '', { algorithm: 'none' })
    : jwt.sign(payload, process.env.JWT_SECRET, { algorithm, expiresIn: '2h' });

describe('auth middleware - JWT algorithm pinning', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { cookies: {}, headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  const callWith = (token) => {
    req.headers.authorization = `Bearer ${token}`;
    auth.authMiddleware(req, res, next);
  };

  test('HS256 access token 은 통과한다 (회귀 없음)', () => {
    const token = signWith({ id: 1, name: '테스트', role: 'owner', type: 'access' }, 'HS256');

    callWith(token);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 1, role: 'owner', type: 'access' });
  });

  test.each(['HS384', 'HS512'])(
    '같은 secret 으로 서명한 %s 토큰은 거부한다 (algorithm 혼동 방어)',
    (algorithm) => {
      const token = signWith({ id: 1, role: 'super_admin', type: 'access' }, algorithm);

      callWith(token);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(req.user).toBeUndefined();
    }
  );

  test('alg=none (서명 없는) 토큰은 거부한다', () => {
    const token = signWith({ id: 1, role: 'super_admin', type: 'access' }, 'none');

    callWith(token);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(req.user).toBeUndefined();
  });

  test('JWT_SECRET 로 서명한 refresh 타입 토큰은 통과하지 않는다', () => {
    const token = signWith({ id: 1, type: 'refresh' }, 'HS256');

    callWith(token);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '액세스 토큰이 필요합니다.' });
  });
});

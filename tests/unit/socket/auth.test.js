const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

process.env.JWT_SECRET = 'socket-test-secret';

const { authenticateSocket, getHandshakeToken } = require('../../../socket/auth');

describe('Socket.IO handshake authentication', () => {
  beforeEach(() => jest.clearAllMocks());

  test('extracts tokens from auth, header, then cookie', () => {
    expect(getHandshakeToken({ auth: { token: 'auth-token' } })).toBe('auth-token');
    expect(getHandshakeToken({ headers: { authorization: 'Bearer header-token' } })).toBe(
      'header-token'
    );
    expect(getHandshakeToken({ headers: { cookie: 'other=1; token=cookie-token' } })).toBe(
      'cookie-token'
    );
  });

  test('ignores malformed encoded cookies', () => {
    expect(getHandshakeToken({ headers: { cookie: 'token=%E0%A4%A' } })).toBeNull();
  });

  test('allows anonymous customer connections without granting a user', () => {
    const socket = { handshake: {}, data: {} };
    const next = jest.fn();

    authenticateSocket(socket, next);

    expect(socket.data.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  test('stores a verified access token identity', () => {
    const user = { id: 7, role: 'owner', type: 'access' };
    jwt.verify.mockReturnValue(user);
    const socket = { handshake: { auth: { token: 'valid-token' } }, data: {} };
    const next = jest.fn();

    authenticateSocket(socket, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'socket-test-secret');
    expect(socket.data.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  test.each(['refresh', '2fa_pending'])('rejects %s tokens', (type) => {
    jwt.verify.mockReturnValue({ id: 7, role: 'super_admin', type });
    const socket = { handshake: { auth: { token: 'invalid-type-token' } }, data: {} };
    const next = jest.fn();

    authenticateSocket(socket, next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.data).toEqual({ code: 'UNAUTHENTICATED' });
    expect(socket.data.user).toBeUndefined();
  });
});

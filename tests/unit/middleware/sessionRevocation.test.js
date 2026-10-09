jest.mock(
  '../../../services/AuthSessionService',
  () => ({ verifyAccess: jest.fn().mockRejectedValue(new Error('SESSION_REVOKED')) }),
  { virtual: true }
);
const jwt = require('jsonwebtoken');
const auth = require('../../../middleware/auth');
test('a signed token from a revoked server session cannot authenticate', async () => {
  const token = jwt.sign(
    { id: 1, role: 'super_admin', type: 'access', sid: 'revoked' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256' }
  );
  const next = jest.fn();
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await auth.authMiddleware(
    { headers: { authorization: 'Bearer ' + token }, cookies: {} },
    res,
    next
  );
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});

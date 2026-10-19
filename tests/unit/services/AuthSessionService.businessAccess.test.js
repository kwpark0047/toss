jest.mock('../../../config/prisma', () => ({
  $transaction: jest.fn(),
  authSession: { updateMany: jest.fn() },
}));

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const db = require('../../../config/prisma');
const sessions = require('../../../services/AuthSessionService');

describe('business account session restrictions', () => {
  const tx = {
    $queryRawUnsafe: jest.fn(),
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';
    db.$transaction.mockImplementation((operation) => operation(tx));
  });

  test.each([
    ['suspended', 'BUSINESS_ACCOUNT_SUSPENDED'],
    ['fraud_review', 'BUSINESS_ACCOUNT_REVIEW'],
    ['rejected', 'BUSINESS_ACCOUNT_REJECTED'],
  ])('does not issue a session for %s accounts', async (status, code) => {
    tx.$queryRawUnsafe.mockResolvedValue([
      { id: 7, auth_status: 'active', business_access_status: status },
    ]);
    await expect(sessions.issue({ id: 7, role: 'user' })).rejects.toMatchObject({
      statusCode: 403,
      code,
    });
    expect(tx.authSession.create).not.toHaveBeenCalled();
  });

  test('an existing access token is denied after an administrator restricts the account', async () => {
    tx.authSession.findUnique.mockResolvedValue({
      id: crypto.randomUUID(),
      user_id: 7,
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
      user: { id: 7, auth_status: 'active', business_access_status: 'fraud_review' },
    });
    await expect(sessions.verifyAccess({ id: 7, sid: crypto.randomUUID() })).rejects.toMatchObject({
      statusCode: 403,
      code: 'BUSINESS_ACCOUNT_REVIEW',
    });
  });

  test('refreshing a restricted account revokes the session and rejects rotation', async () => {
    tx.$queryRawUnsafe.mockResolvedValue([
      { id: 7, auth_status: 'active', business_access_status: 'approved' },
    ]);
    const pair = await sessions.issue({ id: 7, role: 'user' });
    const decoded = jwt.decode(pair.refreshToken);
    tx.authSession.findUnique.mockResolvedValue({
      id: decoded.sid,
      user_id: 7,
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
      user: { id: 7, role: 'user', auth_status: 'active', business_access_status: 'suspended' },
    });
    await expect(sessions.rotate(pair.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: decoded.sid, revoked_at: null },
        data: expect.objectContaining({ revoked_at: expect.any(Date) }),
      })
    );
  });
});


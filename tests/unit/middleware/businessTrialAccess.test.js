const prisma = require('../../../config/prisma');

jest.mock('../../../config/prisma', () => ({ $queryRawUnsafe: jest.fn() }));

const { requireUnexpiredTrial, findExpiredTrial } = require('../../../middleware/businessTrialAccess');

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('business trial write guard', () => {
  beforeEach(() => jest.resetAllMocks());

  test('allows trial accounts until the exact end instant', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ business_access_status: 'trialing', trial_ends_at: new Date(Date.now() + 60_000) }]);
    await expect(findExpiredTrial('15')).resolves.toBe(false);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('trial_ends_at'), 15);
  });

  test('allows users whose access was approved even after the original trial end', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ business_access_status: 'approved', trial_ends_at: new Date(Date.now() - 60_000) }]);
    const next = jest.fn();
    await requireUnexpiredTrial({ user: { id: 15 } }, response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('blocks creating stores when the one-month trial expired', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ business_access_status: 'trialing', trial_ends_at: new Date(Date.now() - 60_000) }]);
    const res = response();
    const next = jest.fn();
    await requireUnexpiredTrial({ user: { id: 15 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});


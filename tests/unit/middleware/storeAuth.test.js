const prisma = require('../../../config/prisma');

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
}));
jest.mock('../../../utils/logger');

const { getStoreRole } = require('../../../middleware/storeAuth');

describe('getStoreRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('only considers active staff memberships', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });

    await expect(getStoreRole(7, 10)).resolves.toBe('manager');

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { store_id: 10, user_id: 7, is_active: 1 },
    });
  });
});

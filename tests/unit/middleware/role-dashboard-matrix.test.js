jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ error: jest.fn() }));
const db = require('../../../config/prisma'),
  { checkStorePermission } = require('../../../middleware/storeAuth');
test.each([
  ['owner', 'store:update', true],
  ['owner', 'payments:collect', true],
  ['owner', 'stats:read', true],
  ['manager', 'orders:manage', true],
  ['manager', 'stats:read', true],
  ['manager', 'payments:collect', true],
  ['manager', 'store:delete', false],
  ['kitchen', 'orders:read', true],
  ['kitchen', 'orders:update', true],
  ['kitchen', 'payments:collect', false],
  ['kitchen', 'staff:manage', false],
  ['kitchen', 'stats:read', false],
  ['kitchen', 'orders:manage', false],
  ['kitchen', 'order:read', false],
])('%s: %s permission is %s', async (role, permission, allowed) => {
  db.stores.findUnique.mockResolvedValue({ user_id: role === 'owner' ? 1 : 99 });
  db.staff.findFirst.mockResolvedValue({ role });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() },
    next = jest.fn();
  await checkStorePermission(permission)(
    { user: { id: 1, role: 'staff' }, params: { storeId: '3' } },
    res,
    next
  );
  expect(next.mock.calls.length > 0).toBe(allowed);
  if (!allowed) expect(res.status).toHaveBeenCalledWith(403);
});
test('unassigned user cannot access any other store dashboard', async () => {
  db.stores.findUnique.mockResolvedValue({ user_id: 99 });
  db.staff.findFirst.mockResolvedValue(null);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() },
    next = jest.fn();
  await checkStorePermission('orders:read')(
    { user: { id: 1, role: 'manager' }, params: { storeId: '4' } },
    res,
    next
  );
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

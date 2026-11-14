const mockEntries = new Map();
const mockPrisma = { stores: { update: jest.fn() } };
jest.mock('../../../config/prisma', () => mockPrisma);
jest.mock('../../../utils/cache', () => ({
  del: jest.fn(async (key) => {
    // Model an asynchronous L2 deletion; profile values have no Redis tag.
    await Promise.resolve();
    mockEntries.delete(key);
  }),
}));
const Store = require('../../../repositories/Store');

test('location update removes the old untagged detail profile before returning', async () => {
  mockEntries.set('store:3', { latitude: 37.5, longitude: 127 });
  mockEntries.set('store:3:profile', { latitude: 37.5, longitude: 127 });
  mockEntries.set('stores:all', [{ id: 3, latitude: 37.5, longitude: 127 }]);
  mockEntries.set('store:30:profile', { id: 30 });
  mockPrisma.stores.update.mockResolvedValue({ id: 3, latitude: 37.6, longitude: 127.1 });

  const updated = await Store.update(3, { latitude: 37.6, longitude: 127.1 });

  expect(updated.latitude).toBe(37.6);
  expect(mockEntries.has('store:3:profile')).toBe(false);
  expect(mockEntries.has('store:3')).toBe(false);
  expect(mockEntries.has('stores:all')).toBe(false);
  expect(mockEntries.get('store:30:profile')).toEqual({ id: 30 });
});

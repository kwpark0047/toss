jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  community_posts: { findMany: jest.fn(), count: jest.fn() },
  store_partnerships: { findMany: jest.fn() },
  store_order_channels: { findUnique: jest.fn(), findMany: jest.fn() },
}));
jest.mock('../../../repositories/Store', () => ({ findById: jest.fn() }));
jest.mock('../../../services/notificationService', () => ({}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock('../../../utils/catchAsync', () => (fn) => fn);
const prisma = require('../../../config/prisma');
const Store = require('../../../repositories/Store');
const community = require('../../../services/CommunityService');
const legal = require('../../../controllers/legalController');
const address = '서울 강남구 역삼동 123-4';
const store = { id: 7, name: 'hidden', address, latitude: 37.5032, longitude: 127.0347 };
const hidden = { store_id: 7, dine_in_enabled: false, hide_exact_address: true };
beforeEach(() => {
  jest.resetAllMocks();
  Store.findById.mockResolvedValue({ ...store });
  prisma.store_order_channels.findUnique.mockResolvedValue(hidden);
  prisma.store_order_channels.findMany.mockResolvedValue([hidden]);
  prisma.stores.findMany.mockResolvedValue([store]);
  prisma.community_posts.findMany.mockResolvedValue([
    { id: 1, stores: store },
    { id: 2, stores: null },
  ]);
  prisma.community_posts.count.mockResolvedValue(2);
});
test.each([null, '', address, '  서울  강남구 역삼동 123-4 '])(
  'legal never exposes hidden fallback or duplicate business address %s',
  async (business_address) => {
    Store.findById.mockResolvedValue({ ...store, business_address });
    const res = { success: jest.fn() };
    await legal.getStoreDisclosures({ params: { storeId: '7' } }, res);
    expect(res.success.mock.calls[0][0].business_address).toBe('미등록');
  }
);
test('distinct configured legal address is preserved', async () => {
  Store.findById.mockResolvedValue({ ...store, business_address: '서울 중구 법인본점 55' });
  const res = { success: jest.fn() };
  await legal.getStoreDisclosures({ params: { storeId: '7' } }, res);
  expect(res.success.mock.calls[0][0].business_address).toBe('서울 중구 법인본점 55');
});
test('legal absent settings preserves legacy fallback', async () => {
  prisma.store_order_channels.findUnique.mockResolvedValue(null);
  const res = { success: jest.fn() };
  await legal.getStoreDisclosures({ params: { storeId: '7' } }, res);
  expect(res.success.mock.calls[0][0].business_address).toBe(address);
});
test('legal settings error propagates without responding', async () => {
  const error = new Error('settings unavailable');
  prisma.store_order_channels.findUnique.mockRejectedValue(error);
  const res = { success: jest.fn() };
  await expect(legal.getStoreDisclosures({ params: { storeId: '7' } }, res)).rejects.toBe(error);
  expect(res.success).not.toHaveBeenCalled();
});
test('feed masks nested stores and retains null relations', async () => {
  const result = await community.getFeed({});
  expect(result.posts[0].stores.address).toBe('서울 강남구');
  expect(JSON.stringify(result)).not.toContain(address);
  expect(result.posts[1].stores).toBeNull();
  expect(prisma.store_order_channels.findMany).toHaveBeenCalledTimes(1);
});
test('nearby masks exact address and coordinates', async () => {
  const result = await community.getNearbyStores({ district: '서울 강남구' });
  expect(result.stores[0]).toMatchObject({
    address: '서울 강남구',
    latitude: null,
    longitude: null,
  });
  expect(JSON.stringify(result)).not.toContain(address);
});
test.each(['feed', 'nearby'])('%s preserves absent settings', async (path) => {
  prisma.store_order_channels.findMany.mockResolvedValue([]);
  const result =
    path === 'feed'
      ? await community.getFeed({})
      : await community.getNearbyStores({ district: '서울 강남구' });
  expect(path === 'feed' ? result.posts[0].stores.address : result.stores[0].address).toBe(address);
});
test.each(['feed', 'nearby'])('%s settings errors propagate', async (path) => {
  const error = new Error('settings unavailable');
  prisma.store_order_channels.findMany.mockRejectedValue(error);
  await expect(
    path === 'feed' ? community.getFeed({}) : community.getNearbyStores({ district: '서울 강남구' })
  ).rejects.toBe(error);
});
test('partnership membership grants no right to another stores hidden address', async () => {
  prisma.stores.findFirst.mockResolvedValue({ id: 1 });
  prisma.store_partnerships.findMany
    .mockResolvedValueOnce([{ target_store: store }])
    .mockResolvedValueOnce([{ requester_store: store }]);
  const result = await community.getPartnerships(1, 10);
  expect(result.sent[0].target_store.address).toBe('서울 강남구');
  expect(result.received[0].requester_store.address).toBe('서울 강남구');
  expect(JSON.stringify(result)).not.toContain(address);
});

test('mixed feed keeps visible and absent-row stores exact while masking hidden store', async () => {
  const visible = { ...store, id: 8, address: '서울 강남구 공개매장 8' };
  const legacy = { ...store, id: 9, address: '서울 강남구 기존매장 9' };
  prisma.community_posts.findMany.mockResolvedValue([
    { stores: store },
    { stores: visible },
    { stores: legacy },
  ]);
  prisma.store_order_channels.findMany.mockResolvedValue([
    hidden,
    { store_id: 8, dine_in_enabled: true, hide_exact_address: false },
  ]);
  const result = await community.getFeed({});
  expect(result.posts.map((post) => post.stores.address)).toEqual([
    '서울 강남구',
    visible.address,
    legacy.address,
  ]);
});
test('partnership settings error propagates', async () => {
  prisma.stores.findFirst.mockResolvedValue({ id: 1 });
  prisma.store_partnerships.findMany.mockResolvedValue([
    { target_store: store, requester_store: store },
  ]);
  const error = new Error('unavailable');
  prisma.store_order_channels.findMany.mockRejectedValue(error);
  await expect(community.getPartnerships(1, 10)).rejects.toBe(error);
});

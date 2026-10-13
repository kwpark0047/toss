jest.mock('../../../config/prisma', () => ({
  orders: { groupBy: jest.fn() },
  stores: { findMany: jest.fn(), count: jest.fn() },
  store_business_info: { findMany: jest.fn() },
  store_favorites: { findMany: jest.fn() },
}));
const db = require('../../../config/prisma'),
  Service = require('../../../services/StoreService');
beforeEach(() => jest.clearAllMocks());
test('search uses normalized filters, hours and business facets', async () => {
  db.stores.count.mockResolvedValue(1);
  db.stores.findMany.mockImplementation(async (args) => {
    expect(args.select.business_type).toBeUndefined();
    expect(args.select.open_time).toBeUndefined();
    expect(args.where.store_business_info).toEqual({ is: { business_type: 'restaurant' } });
    return [
      {
        id: 3,
        store_business_info: { business_type: 'restaurant' },
        store_operating_hours: { open_time: '09:00' },
      },
    ];
  });
  db.store_business_info.findMany.mockResolvedValue([{ business_type: 'restaurant' }]);
  const x = await new Service().searchStores({ business_type: 'restaurant' });
  expect(x.stores[0]).toMatchObject({ business_type: 'restaurant', open_time: '09:00' });
  expect(x.facets.businessTypes).toEqual(['restaurant']);
});
test('popular uses business relation while preserving flat output', async () => {
  db.orders.groupBy.mockResolvedValue([{ store_id: 3, _count: { _all: 2 } }]);
  db.stores.findMany.mockImplementation(async (args) => {
    expect(args.select.business_type).toBeUndefined();
    return [{ id: 3, store_business_info: { business_type: 'restaurant' }, _count: { orders: 2 } }];
  });
  expect((await new Service().getPopular())[0]).toMatchObject({
    business_type: 'restaurant',
    order_count: 2,
  });
});

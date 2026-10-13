jest.mock('../../../services/StoreService', () => jest.fn());
jest.mock('../../../repositories/Store', () => ({ findAll: jest.fn() }));
jest.mock('../../../config/prisma', () => ({ stores: { findMany: jest.fn() } }));
const db = require('../../../config/prisma');
const controller = require('../../../controllers/storeController');
test('limited public store list uses normalized business relation and preserves flat contract', async () => {
  db.stores.findMany.mockImplementation(async (args) => {
    if (args.select.business_type) throw Error('Unknown field business_type');
    expect(args.select.store_business_info).toEqual({ select: { business_type: true } });
    expect(args.take).toBe(200);
    return [{ id: 3, name: 'fixture', store_business_info: { business_type: 'restaurant' } }];
  });
  const res = { success: jest.fn() };
  await controller.getStores({ query: { limit: '500' } }, res);
  expect(res.success).toHaveBeenCalledWith([
    { id: 3, name: 'fixture', business_type: 'restaurant' },
  ]);
});

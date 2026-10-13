jest.mock('../../../config/prisma', () => ({
  orders: { findMany: jest.fn() },
  stores: { findMany: jest.fn(), count: jest.fn() },
  ledger: { findMany: jest.fn(), groupBy: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn() }));
jest.mock('../../../repositories/Store', () => ({}));
jest.mock('../../../services/StoreInfoEnhancementService', () => ({}));
const db = require('../../../config/prisma'),
  controller = require('../../../controllers/platformController');
test('today KST includes collected income less refund, never unpaid order totals', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-12T14:00:00Z'));
  db.orders.findMany.mockResolvedValue([
    { created_at: new Date('2026-10-12T01:00:00Z'), total_amount: 99999 },
  ]);
  db.stores.findMany.mockResolvedValue([]);
  db.ledger.findMany.mockResolvedValue([
    { created_at: new Date('2026-10-12T01:00:00Z'), type: 'INCOME', amount: 1000 },
    { created_at: new Date('2026-10-12T02:00:00Z'), type: 'REFUND', amount: 200 },
  ]);
  const res = { success: jest.fn() },
    next = jest.fn();
  await controller.getTrend({ query: { days: '2' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.success.mock.calls[0][0].daily.at(-1)).toEqual({
    date: '2026-10-12',
    orders: 1,
    sales: 800,
    newStores: 0,
  });
  jest.useRealTimers();
});
test('store list displays actual net ledger totals rather than placeholder zero', async () => {
  db.stores.findMany.mockResolvedValue([
    { id: 1, name: 'test', _count: { orders: 2, store_customers: 1 } },
  ]);
  db.stores.count.mockResolvedValue(1);
  db.ledger.groupBy.mockResolvedValue([
    { store_id: 1, type: 'INCOME', _sum: { amount: 1000 } },
    { store_id: 1, type: 'REFUND', _sum: { amount: 200 } },
  ]);
  const res = { success: jest.fn() },
    next = jest.fn();
  await controller.getStores({ query: {} }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.success.mock.calls[0][0].stores[0].sales).toBe(800);
});

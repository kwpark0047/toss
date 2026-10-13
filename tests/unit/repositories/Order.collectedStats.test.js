jest.mock('../../../config/prisma', () => ({
  orders: {
    aggregate: jest.fn().mockResolvedValue({ _count: { id: 2 }, _sum: { total_amount: 9999 } }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  ledger: { groupBy: jest.fn() },
}));
const db = require('../../../config/prisma'),
  Order = require('../../../repositories/Order');
test('business stats use collected income less refund rather than unpaid order amounts', async () => {
  db.ledger.groupBy.mockResolvedValue([
    { type: 'INCOME', _sum: { amount: 1000 } },
    { type: 'REFUND', _sum: { amount: 200 } },
  ]);
  expect((await Order.getStats(3)).total_sales).toBe(800);
});
test('stats database failure propagates rather than reporting zero sales', async () => {
  db.orders.aggregate.mockRejectedValueOnce(Error('fixture database failure'));
  await expect(Order.getStats(3)).rejects.toThrow('fixture database failure');
});

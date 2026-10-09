jest.mock('../../../config/prisma', () => ({ orders: { findMany: jest.fn() } }));
const db = require('../../../config/prisma');
const Order = require('../../../repositories/Order');
test('private history DB failure does not propagate an exception containing customer identifiers', async () => {
  db.orders.findMany.mockRejectedValue(new Error('private 01011112222 query failure'));
  await expect(Order.findByCustomerInStore(3, '01011112222')).resolves.toEqual([]);
});

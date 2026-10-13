jest.mock('../../../utils/planQuota', () => ({ assertPlanQuota: jest.fn() }));
jest.mock('../../../config/prisma', () => ({ $transaction: jest.fn() }));
const db = require('../../../config/prisma'),
  Order = require('../../../repositories/Order');
test('new order number uses the store KST day without rewriting existing order numbers', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-12T16:00:00Z'));
  db.$transaction.mockImplementation(async (callback) =>
    callback({
      products: { findMany: async () => [{ id: 1, store_id: 3, is_active: true, price: 1000 }] },
      orders: { create: async ({ data }) => ({ id: 1, ...data }) },
      order_items: { createMany: async () => ({ count: 1 }) },
    })
  );
  try {
    const order = await Order.create({ store_id: 3, items: [{ product_id: 1, quantity: 1 }] });
    expect(order.order_number).toMatch(/^20261013-/);
  } finally {
    jest.useRealTimers();
  }
});

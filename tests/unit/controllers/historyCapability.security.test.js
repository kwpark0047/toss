jest.mock('../../../utils/catchAsync', () => (fn) => fn);
jest.mock('../../../services/OrderService', () =>
  jest.fn().mockImplementation(() => ({
    createOrder: jest.fn().mockResolvedValue({ id: 10, store_id: 3 }),
  }))
);
jest.mock('../../../repositories/Order', () => ({
  findHistoryByCapability: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
}));
const controller = require('../../../controllers/orderController');
const jwt = require('jsonwebtoken');
const { createCustomerHistoryCapability } = require('../../../utils/orderCapability');
const Order = require('../../../repositories/Order');
test('customer token registration checks the active order repository', async () => {
  Order.findById.mockResolvedValue(null);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.registerCustomerToken(
    { params: { orderId: '10' }, body: { token: 'fixture-fcm' } },
    res
  );
  expect(Order.findById).toHaveBeenCalledWith(10);
  expect(res.status).toHaveBeenCalledWith(404);
});
test('detail uses the active repository and never exposes provider secrets', async () => {
  Order.findById.mockResolvedValue({
    id: 10,
    store_id: 3,
    items: [],
    payments: [
      { id: 1, status: 'DONE', amount: 100, payment_key: 'secret', raw_response: { secret: 'x' } },
    ],
  });
  const res = { success: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.getOrderDetails({ params: { id: '10' } }, res);
  expect(res.success.mock.calls[0][0].payments[0].payment_key).toBeUndefined();
  expect(res.success.mock.calls[0][0].payments[0].raw_response).toBeUndefined();
});
test('claimed victim phone/external ID cannot expand an order creation token', async () => {
  const res = { created: jest.fn() };
  await controller.createOrder(
    {
      app: { get: () => null },
      get: () => undefined,
      body: { phone: '01011112222', toss_user_key: 'victim', order_ids: [9000] },
    },
    res
  );
  const proof = jwt.decode(res.created.mock.calls[0][0].customer_history_capability);
  expect(proof.orderIds).toEqual([10]);
  expect(proof.storeId).toBe(3);
  expect(proof.phone).toBeUndefined();
});
test('history chaining accepts previously possessed orders only in the same store', async () => {
  const res = { created: jest.fn() };
  const owned = createCustomerHistoryCapability({ store_id: 4, order_ids: [20] });
  await controller.createOrder({ app: { get: () => null }, get: () => owned, body: {} }, res);
  expect(jwt.decode(res.created.mock.calls[0][0].customer_history_capability).orderIds).toEqual([
    10,
  ]);
});
test('history lookup supplies both verified store and owned order IDs', async () => {
  const proof = createCustomerHistoryCapability({ store_id: 3, order_ids: [10] });
  await controller.getCustomerHistory({ get: () => proof }, { success: jest.fn() });
  expect(Order.findHistoryByCapability).toHaveBeenCalledWith(3, [10]);
});

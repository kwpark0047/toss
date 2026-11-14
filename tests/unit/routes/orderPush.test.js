const express = require('express'),
  request = require('supertest');
jest.mock('../../../config/prisma', () => ({ orders: { findUnique: jest.fn() } }));
jest.mock('../../../services/OrderWebPushService', () => ({
  config: () => ({ publicKey: 'public-only' }),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}));
jest.mock('../../../utils/orderCapability', () => ({
  verifyOrderCapability: jest.fn(),
  verifyCustomerHistoryCapability: jest.fn(),
}));
const db = require('../../../config/prisma'),
  cap = require('../../../utils/orderCapability'),
  push = require('../../../services/OrderWebPushService');
const app = express();
app.use(express.json());
app.use('/orders', require('../../../routes/orderPush'));
beforeEach(() => {
  jest.clearAllMocks();
  db.orders.findUnique.mockResolvedValue({ store_id: 2, status: 'preparing' });
  cap.verifyOrderCapability.mockReturnValue(null);
  cap.verifyCustomerHistoryCapability.mockReturnValue(null);
});
test('public config contains no private key', async () => {
  expect((await request(app).get('/orders/push/config')).body).toEqual({
    enabled: true,
    publicKey: 'public-only',
  });
});
test('cannot subscribe arbitrary order without capability', async () => {
  expect((await request(app).post('/orders/3/push-subscription').send({})).status).toBe(403);
  expect(db.orders.findUnique).not.toHaveBeenCalled();
});
test('signed scope must match stored store', async () => {
  cap.verifyOrderCapability.mockReturnValue({ orderId: 3, storeId: 9 });
  expect((await request(app).post('/orders/3/push-subscription').send({})).status).toBe(403);
  expect(push.subscribe).not.toHaveBeenCalled();
});
test('owned history authorizes registration and deletion', async () => {
  cap.verifyCustomerHistoryCapability.mockReturnValue({ storeId: 2, orderIds: [3] });
  expect(
    (
      await request(app)
        .post('/orders/3/push-subscription')
        .send({ subscription: { endpoint: 'test' } })
    ).status
  ).toBe(200);
  expect(push.subscribe).toHaveBeenCalledWith(3, { endpoint: 'test' });
  expect(
    (await request(app).delete('/orders/3/push-subscription').send({ endpoint: 'test' })).status
  ).toBe(200);
});
test('ended order cannot be newly subscribed', async () => {
  cap.verifyOrderCapability.mockReturnValue({ orderId: 3, storeId: 2 });
  db.orders.findUnique.mockResolvedValue({ store_id: 2, status: 'completed' });
  expect((await request(app).post('/orders/3/push-subscription').send({})).status).toBe(409);
});

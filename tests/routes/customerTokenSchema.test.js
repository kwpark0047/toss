const express = require('express');
const request = require('supertest');

process.env.ORDER_CAPABILITY_SECRET = 'customer-token-schema-secret';

const mockOrdersController = {
  createOrder: jest.fn(),
  getCustomerHistory: jest.fn(),
  registerCustomerToken: jest.fn((req, res) => res.json({ success: true })),
  getDetailedStats: jest.fn(),
  getStats: jest.fn(),
  getStoreOrders: jest.fn(),
  getOrderDetails: jest.fn(),
  updateStatus: jest.fn(),
  cancelOrder: jest.fn(),
  deleteOrder: jest.fn(),
  getEta: jest.fn(),
  returnExchange: jest.fn(),
  searchOrders: jest.fn(),
};

// validate.js는 목킹하지 않는다 — 스키마 배선(orderIdParamSchema vs customerTokenParamSchema)이
// 실제로 동작하는지 검증해야 하므로, 실 validateParams가 req.params를 파싱하게 둔다.
jest.mock('../../controllers/orderController', () => mockOrdersController);
jest.mock('../../middleware/idempotency', () => () => (req, res, next) => next());
jest.mock('../../middleware/auth', () => {
  const auth = (req, res, next) => next();
  auth.optionalAuth = (req, res, next) => next();
  return auth;
});

const { createOrderCapability } = require('../../utils/orderCapability');
const ordersRouter = require('../../routes/orders');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/orders', ordersRouter);
  return instance;
}

describe('customer token schema wiring (regression)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a capability for another order via real validateParams', async () => {
    const capability = createOrderCapability({ id: 11, store_id: 3 });
    const response = await request(app())
      .post('/api/orders/10/customer-token')
      .set('x-order-capability', capability)
      .send({ token: 'fcm-token' });

    // orderIdParamSchema(구 배선)였다면 :orderId 파라미터를 파싱하지 못해 400이었다.
    // customerTokenParamSchema로 배선한 지금은 capability 불일치 → 403이어야 한다.
    expect(response.status).toBe(403);
    expect(response.body.code).toBeUndefined();
    expect(mockOrdersController.registerCustomerToken).not.toHaveBeenCalled();
  });

  test('accepts the matching order capability', async () => {
    const capability = createOrderCapability({ id: 10, store_id: 3 });
    const response = await request(app())
      .post('/api/orders/10/customer-token')
      .set('x-order-capability', capability)
      .send({ token: 'fcm-token' });

    expect(response.status).toBe(200);
    expect(mockOrdersController.registerCustomerToken).toHaveBeenCalled();
  });
});

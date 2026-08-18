const express = require('express');
const request = require('supertest');

process.env.ORDER_CAPABILITY_SECRET = 'customer-capability-route-secret';

const mockOrdersController = {
  createOrder: jest.fn(),
  getCustomerHistory: jest.fn((req, res) => res.json({ success: true })),
  registerCustomerToken: jest.fn((req, res) => res.json({ success: true })),
  getDetailedStats: jest.fn(),
  getStats: jest.fn(),
  getStoreOrders: jest.fn(),
  getOrderDetails: jest.fn((req, res) => res.json({ success: true })),
  updateStatus: jest.fn(),
  cancelOrder: jest.fn(),
  deleteOrder: jest.fn(),
  getEta: jest.fn((req, res) => res.json({ success: true })),
};
const mockReservationsController = {
  register: jest.fn(),
  getStoreReservations: jest.fn(),
  updateStatus: jest.fn(),
  getMyReservations: jest.fn((req, res) => res.json({ success: true })),
  cancelReservation: jest.fn((req, res) => res.json({ success: true })),
};
const mockPointsController = {
  getBalance: jest.fn(),
  getHistory: jest.fn(),
  walletLookup: jest.fn((req, res) => res.json({ success: true })),
  calculateEarnPoints: jest.fn(),
  calculateUsablePoints: jest.fn(),
  getStoreSettings: jest.fn(),
  updateStoreSettings: jest.fn(),
  adminEarn: jest.fn(),
  adminDeduct: jest.fn(),
};
const mockObjectPermission = jest.fn((req, res, next) => next());

jest.mock('../../controllers/orderController', () => mockOrdersController);
jest.mock('../../controllers/reservationsController', () => mockReservationsController);
jest.mock('../../controllers/pointsController', () => mockPointsController);
jest.mock('../../middleware/idempotency', () => () => (req, res, next) => next());
jest.mock('../../middleware/validate', () => () => (req, res, next) => next());
jest.mock('../../middleware/validator', () => ({
  validateBody: () => (req, res, next) => next(),
  validateId: () => (req, res, next) => next(),
}));
jest.mock('../../middleware/auth', () => {
  const auth = (req, res, next) => next();
  auth.optionalAuth = (req, res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { id: 1, role };
    next();
  };
  return auth;
});
jest.mock('../../middleware/storeAuth', () => ({
  checkStorePermission: () => (req, res, next) => next(),
  checkStorePermissionForObject: () => mockObjectPermission,
  checkResourcePermission: () => (req, res, next) => next(),
}));

const {
  createOrderCapability,
  createReservationCapability,
  createCustomerHistoryCapability,
} = require('../../utils/orderCapability');
const ordersRouter = require('../../routes/orders');
const reservationsRouter = require('../../routes/reservations');
const pointsRouter = require('../../routes/points');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/orders', ordersRouter);
  instance.use('/api/reservations', reservationsRouter);
  instance.use('/api/points', pointsRouter);
  return instance;
}

describe('customer capability route boundaries', () => {
  beforeEach(() => jest.clearAllMocks());

  test('order details reject a sequential id without a capability', async () => {
    const response = await request(app()).get('/api/orders/10');

    expect(response.status).toBe(403);
    expect(mockOrdersController.getOrderDetails).not.toHaveBeenCalled();
  });

  test('customer order history rejects phone-only lookup', async () => {
    const response = await request(app()).get('/api/orders/customer/history?phone=01012345678');

    expect(response.status).toBe(403);
    expect(mockOrdersController.getCustomerHistory).not.toHaveBeenCalled();
  });

  test('customer order history accepts a matching history capability', async () => {
    const capability = createCustomerHistoryCapability({ phone: '01012345678' });
    const response = await request(app())
      .get('/api/orders/customer/history?phone=99999999999')
      .set('x-customer-history-capability', capability);

    expect(response.status).toBe(200);
    expect(mockOrdersController.getCustomerHistory).toHaveBeenCalled();
  });

  test('order details accept the matching order capability', async () => {
    const capability = createOrderCapability({ id: 10, store_id: 3 });
    const response = await request(app())
      .get('/api/orders/10')
      .set('x-order-capability', capability);

    expect(response.status).toBe(200);
    expect(mockOrdersController.getOrderDetails).toHaveBeenCalled();
  });

  test.each(['staff', 'super_admin'])('keeps authenticated %s order access', async (role) => {
    const response = await request(app()).get('/api/orders/10').set('x-test-role', role);

    expect(response.status).toBe(200);
    expect(mockObjectPermission).toHaveBeenCalled();
  });

  test('customer token registration rejects a capability for another order', async () => {
    const capability = createOrderCapability({ id: 11, store_id: 3 });
    const response = await request(app())
      .post('/api/orders/10/customer-token')
      .set('x-order-capability', capability)
      .send({ token: 'fcm-token' });

    expect(response.status).toBe(403);
    expect(mockOrdersController.registerCustomerToken).not.toHaveBeenCalled();
  });

  test('reservation lookup rejects an arbitrary phone without its capability', async () => {
    const response = await request(app()).get('/api/reservations/my/01012345678');

    expect(response.status).toBe(403);
    expect(mockReservationsController.getMyReservations).not.toHaveBeenCalled();
  });

  test('reservation cancellation rejects a capability for another reservation', async () => {
    const capability = createReservationCapability({
      id: 20,
      store_id: 3,
      customer_phone: '01012345678',
    });
    const response = await request(app())
      .patch('/api/reservations/21/cancel')
      .set('x-order-capability', capability);

    expect(response.status).toBe(403);
    expect(mockReservationsController.cancelReservation).not.toHaveBeenCalled();
  });

  test('wallet lookup rejects phone and store values outside the order capability', async () => {
    const capability = createOrderCapability({
      id: 10,
      store_id: 3,
      customer_phone: '01012345678',
    });
    const response = await request(app())
      .get('/api/points/wallet-lookup?phone=01012345678&store_id=4')
      .set('x-order-capability', capability);

    expect(response.status).toBe(403);
    expect(mockPointsController.walletLookup).not.toHaveBeenCalled();
  });
});

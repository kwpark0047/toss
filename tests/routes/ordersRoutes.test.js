const express = require('express');
// 라우트 계층(인증·검증·권한·capability) 경계만 검증한다. 주문 도메인 로직은
// OrderService 단위 테스트와 PostgreSQL 회귀 테스트가 담당한다.
jest.mock('../../services/AuthSessionService', () => ({
  verifyAccess: jest.fn(async (decoded) => decoded),
}));
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'orders-route-test-secret';

const mockPrisma = {
  $queryRawUnsafe: jest
    .fn()
    .mockResolvedValue([{ business_access_status: 'approved', trial_ends_at: null }]),
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
  orders: { findUnique: jest.fn() },
  idempotencyRecord: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockController = {
  createOrder: jest.fn((_req, res) => res.status(201).json({ success: true })),
  registerCustomerToken: jest.fn((_req, res) => res.json({ success: true })),
  getCustomerHistory: jest.fn((_req, res) => res.json({ success: true })),
  getDetailedStats: jest.fn((_req, res) => res.json({ success: true })),
  getStats: jest.fn((_req, res) => res.json({ success: true })),
  getStoreOrders: jest.fn((_req, res) => res.json({ success: true, data: [] })),
  getOrderDetails: jest.fn((_req, res) => res.json({ success: true })),
  updateStatus: jest.fn((_req, res) => res.json({ success: true })),
  cancelOrder: jest.fn((_req, res) => res.json({ success: true })),
  returnExchange: jest.fn((_req, res) => res.json({ success: true })),
  deleteOrder: jest.fn((_req, res) => res.json({ success: true })),
  getEta: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/orderController', () => mockController);

const router = require('../../routes/orders');
const { createOrderCapability } = require('../../utils/orderCapability');

const OWNER_ID = 99;
const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', router);
  // 라우트에서 next(err) 로 넘어온 검증 오류를 상태 코드로 노출한다.
  app.use((err, _req, res, _next) =>
    res.status(err.statusCode || err.status || 500).json({ error: err.message })
  );
  return app;
};

const validOrder = {
  store_id: 3,
  table_id: 5,
  total_amount: 12000,
  payment_method: 'card',
  items: [{ product_id: 1, product_name: '아메리카노', quantity: 2, price: 6000, subtotal: 12000 }],
};

describe('orders routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: OWNER_ID });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    mockPrisma.orders.findUnique.mockResolvedValue({ id: 10, store_id: 3 });
  });

  describe('POST /api/orders (주문 생성)', () => {
    it('유효한 주문은 컨트롤러로 전달된다', async () => {
      const res = await request(buildApp()).post('/api/orders').send(validOrder);
      expect(res.status).toBe(201);
      expect(mockController.createOrder).toHaveBeenCalledTimes(1);
    });

    it('품목이 없는 주문은 검증 단계에서 거부된다', async () => {
      const res = await request(buildApp())
        .post('/api/orders')
        .send({ ...validOrder, items: [] });
      expect(res.status).toBe(400);
      expect(mockController.createOrder).not.toHaveBeenCalled();
    });

    it('음수 수량은 거부된다', async () => {
      const res = await request(buildApp())
        .post('/api/orders')
        .send({ ...validOrder, items: [{ ...validOrder.items[0], quantity: -1 }] });
      expect(res.status).toBe(400);
      expect(mockController.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/orders/store/:storeId (매장 주문 목록)', () => {
    it('토큰이 없으면 401', async () => {
      const res = await request(buildApp()).get('/api/orders/store/3');
      expect(res.status).toBe(401);
      expect(mockController.getStoreOrders).not.toHaveBeenCalled();
    });

    it('매장 소유자는 조회할 수 있다', async () => {
      const res = await request(buildApp())
        .get('/api/orders/store/3')
        .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'owner')}`);
      expect(res.status).toBe(200);
      expect(mockController.getStoreOrders).toHaveBeenCalledTimes(1);
    });

    it('소속이 아닌 사용자는 403', async () => {
      const res = await request(buildApp())
        .get('/api/orders/store/3')
        .set('Authorization', `Bearer ${tokenFor(7, 'owner')}`);
      expect(res.status).toBe(403);
      expect(mockController.getStoreOrders).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/orders/:id (주문 상세)', () => {
    it('해당 주문의 capability 가 있으면 비로그인 고객도 조회할 수 있다', async () => {
      const capability = createOrderCapability({ id: 10, store_id: 3 });
      const res = await request(buildApp())
        .get('/api/orders/10')
        .set('x-order-capability', capability);
      expect(res.status).toBe(200);
      expect(mockController.getOrderDetails).toHaveBeenCalledTimes(1);
    });

    it('다른 주문의 capability 로는 조회할 수 없다', async () => {
      const capability = createOrderCapability({ id: 11, store_id: 3 });
      const res = await request(buildApp())
        .get('/api/orders/10')
        .set('x-order-capability', capability);
      expect(res.status).toBe(403);
      expect(mockController.getOrderDetails).not.toHaveBeenCalled();
    });

    it('capability 도 로그인도 없으면 403', async () => {
      const res = await request(buildApp()).get('/api/orders/10');
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/orders/:id/status (상태 변경)', () => {
    it('매장 소유자는 상태를 변경할 수 있다', async () => {
      const res = await request(buildApp())
        .put('/api/orders/10/status')
        .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'owner')}`)
        .send({ status: 'preparing' });
      expect(res.status).toBe(200);
      expect(mockController.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('정의되지 않은 상태 값은 거부된다', async () => {
      const res = await request(buildApp())
        .put('/api/orders/10/status')
        .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'owner')}`)
        .send({ status: 'teleported' });
      expect(res.status).toBe(400);
      expect(mockController.updateStatus).not.toHaveBeenCalled();
    });

    it('토큰이 없으면 401', async () => {
      const res = await request(buildApp())
        .put('/api/orders/10/status')
        .send({ status: 'preparing' });
      expect(res.status).toBe(401);
    });

    it('타 매장 사용자는 403', async () => {
      const res = await request(buildApp())
        .put('/api/orders/10/status')
        .set('Authorization', `Bearer ${tokenFor(7, 'owner')}`)
        .send({ status: 'preparing' });
      expect(res.status).toBe(403);
      expect(mockController.updateStatus).not.toHaveBeenCalled();
    });
  });
});

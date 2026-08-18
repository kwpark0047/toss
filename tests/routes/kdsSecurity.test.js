const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'kds-security-test-secret';

const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockController = {
  getActiveOrders: jest.fn((_req, res) => res.json({ success: true })),
  updateOrderStatus: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/kdsController', () => mockController);

const router = require('../../routes/kds');

const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/kds', router);
  return app;
};

describe('KDS role boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'kitchen', is_active: 1 });
  });

  it('주방 계정은 자기 매장 KDS를 조회하고 상태를 변경할 수 있다', async () => {
    const app = buildApp();
    const token = tokenFor(7, 'kitchen');

    const list = await request(app)
      .get('/api/kds/stores/3/orders')
      .set('Authorization', `Bearer ${token}`);
    const update = await request(app)
      .post('/api/kds/stores/3/orders/10/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'preparing' });

    expect(list.status).toBe(200);
    expect(update.status).toBe(200);
  });

  it('다른 매장 소속이 아닌 주방 계정은 KDS 접근이 거부된다', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    const response = await request(buildApp())
      .get('/api/kds/stores/3/orders')
      .set('Authorization', `Bearer ${tokenFor(7, 'kitchen')}`);

    expect(response.status).toBe(403);
    expect(mockController.getActiveOrders).not.toHaveBeenCalled();
  });
});

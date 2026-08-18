const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'order-event-route-test-secret';

const mockController = { list: jest.fn((_req, res) => res.json({ success: true })) };
jest.mock('../../controllers/orderEventController', () => mockController);

const router = require('../../routes/orderEvents');
const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
};

describe('order event route security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('일반 사업자 계정은 주문 이벤트를 조회할 수 없다', async () => {
    const response = await request(buildApp())
      .get('/api/admin/order-events?storeId=3')
      .set('Authorization', `Bearer ${tokenFor(7, 'owner')}`);

    expect(response.status).toBe(403);
    expect(mockController.list).not.toHaveBeenCalled();
  });

  it('슈퍼관리자는 주문 이벤트 필터를 조회할 수 있다', async () => {
    const response = await request(buildApp())
      .get('/api/admin/order-events?storeId=3&orderId=10&limit=20')
      .set('Authorization', `Bearer ${tokenFor(99, 'super_admin')}`);

    expect(response.status).toBe(200);
    expect(mockController.list).toHaveBeenCalled();
  });
});

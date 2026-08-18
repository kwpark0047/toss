const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'customer-management-test-secret';

const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockController = {
  getStats: jest.fn((_req, res) => res.json({ success: true })),
  getHistory: jest.fn((_req, res) => res.json({ success: true })),
  getCoupons: jest.fn((_req, res) => res.json({ success: true })),
  issueCoupon: jest.fn((_req, res) => res.json({ success: true })),
  getCustomers: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/customerController', () => mockController);

const router = require('../../routes/customers');

const tokenFor = (id, role = 'manager') =>
  jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', router);
  return app;
};

describe('customer management tenant boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
  });

  it('manager can read customers for an assigned store', async () => {
    const response = await request(buildApp())
      .get('/api/customers/3')
      .set('Authorization', `Bearer ${tokenFor(7)}`);

    expect(response.status).toBe(200);
    expect(mockController.getCustomers).toHaveBeenCalled();
  });

  it('a user without store membership is denied', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    const response = await request(buildApp())
      .get('/api/customers/3')
      .set('Authorization', `Bearer ${tokenFor(7)}`);

    expect(response.status).toBe(403);
    expect(mockController.getCustomers).not.toHaveBeenCalled();
  });

  it('customer management requires authentication', async () => {
    const response = await request(buildApp()).get('/api/customers/3');
    expect(response.status).toBe(401);
  });
});

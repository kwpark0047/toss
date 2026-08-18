const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-automation-route-test-secret';

const mockPrisma = { stores: { findUnique: jest.fn() }, staff: { findFirst: jest.fn() } };
jest.mock('../../config/prisma', () => mockPrisma);
jest.mock('../../controllers/crmAutomationController', () => ({
  generate: (_req, res) => res.json({ success: true }),
  list: (_req, res) => res.json({ success: true }),
  decide: (_req, res) => res.json({ success: true }),
  send: (_req, res) => res.json({ success: true }),
}));

const router = require('../../routes/crm');
const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/crm', router);
  return app;
};

describe('CRM automation security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });
  });

  it('manager can generate a campaign for an assigned store', async () => {
    const response = await request(buildApp())
      .post('/api/crm/store/3/automation-campaigns/generate')
      .set('Authorization', `Bearer ${tokenFor(7, 'manager')}`)
      .send({ segmentName: 'New', message: '환영합니다.' });
    expect(response.status).toBe(200);
  });

  it('outsider cannot access CRM automation', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    const response = await request(buildApp())
      .get('/api/crm/store/3/automation-campaigns')
      .set('Authorization', `Bearer ${tokenFor(7, 'manager')}`);
    expect(response.status).toBe(403);
  });
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'inventory-reorder-route-test-secret';

const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);
jest.mock('../../controllers/inventoryController', () => ({
  getInventory: (_req, res) => res.json({ success: true }),
  adjustStock: (_req, res) => res.json({ success: true }),
  setStock: (_req, res) => res.json({ success: true }),
  getStockHistory: (_req, res) => res.json({ success: true }),
  getStoreStockHistory: (_req, res) => res.json({ success: true }),
  getLowStockAlerts: (_req, res) => res.json({ success: true }),
}));
const mockReorderController = {
  generate: jest.fn((_req, res) => res.json({ success: true })),
  list: jest.fn((_req, res) => res.json({ success: true })),
  decide: jest.fn((_req, res) => res.json({ success: true })),
};
jest.mock('../../controllers/inventoryReorderController', () => mockReorderController);

const router = require('../../routes/inventory');
const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', router);
  return app;
};

describe('inventory reorder route security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    mockPrisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });
  });

  it('manager can generate reorder candidates for an assigned store', async () => {
    const response = await request(buildApp())
      .post('/api/inventory/store/3/reorder-candidates/generate')
      .set('Authorization', `Bearer ${tokenFor(7, 'manager')}`)
      .send({ lookbackDays: 30 });

    expect(response.status).toBe(200);
    expect(mockReorderController.generate).toHaveBeenCalled();
  });

  it('an outsider cannot access reorder candidates', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    const response = await request(buildApp())
      .get('/api/inventory/store/3/reorder-candidates')
      .set('Authorization', `Bearer ${tokenFor(7, 'manager')}`);

    expect(response.status).toBe(403);
    expect(mockReorderController.list).not.toHaveBeenCalled();
  });
});

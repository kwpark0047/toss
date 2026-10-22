const express = require('express');
jest.mock('../../services/AuthSessionService', () => ({
  verifyAccess: jest.fn(async (decoded) => decoded),
}));
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'business-trial-route-test-secret';

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
  categories: { findMany: jest.fn(), findUnique: jest.fn() },
  products: { findUnique: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const mockCategoriesController = {
  updateSortOrders: jest.fn((_req, res) => res.json({ updated: true })),
  createCategory: jest.fn((_req, res) => res.status(201).json({ created: true })),
  updateCategory: jest.fn((_req, res) => res.json({ updated: true })),
  deleteCategory: jest.fn((_req, res) => res.json({ deleted: true })),
  getStoreCategories: jest.fn((_req, res) => res.json([])),
  getAllCategories: jest.fn((_req, res) => res.json([])),
  getCategoryById: jest.fn((_req, res) => res.json({})),
};
jest.mock('../../controllers/categoriesController', () => mockCategoriesController);

const mockProductsController = {
  getStoreProducts: jest.fn((_req, res) => res.json([])),
  getProductById: jest.fn((_req, res) => res.json({})),
  createProduct: jest.fn((_req, res) => res.status(201).json({ created: true })),
  updateProduct: jest.fn((_req, res) => res.json({ updated: true })),
  deleteProduct: jest.fn((_req, res) => res.json({ deleted: true })),
  bulkCreate: jest.fn((_req, res) => res.status(201).json({ created: true })),
  importFromStore: jest.fn((_req, res) => res.json({ imported: true })),
};
jest.mock('../../controllers/productsController', () => mockProductsController);

const responseFormatter = require('../../middleware/responseFormatter');
const app = express();
app.use(express.json());
app.use(responseFormatter);
app.use('/api/categories', require('../../routes/categories'));
app.use('/api/products', require('../../routes/products'));
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));

const ownerToken = jwt.sign({ id: 7, role: 'owner', type: 'access' }, process.env.JWT_SECRET);
const managerToken = jwt.sign({ id: 9, role: 'manager', type: 'access' }, process.env.JWT_SECRET);

describe('business trial category mutation guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ id: 3, user_id: 7 });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    mockPrisma.categories.findMany.mockResolvedValue([{ id: 11, store_id: 3 }]);
    mockPrisma.categories.findUnique.mockResolvedValue({ id: 11, store_id: 3 });
    mockPrisma.products.findUnique.mockResolvedValue({ id: 11, store_id: 3 });
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);
  });

  test('expired trial cannot create a category', async () => {
    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ store_id: 3, name: '테스트' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TRIAL_EXPIRED');
    expect(mockCategoriesController.createCategory).not.toHaveBeenCalled();
  });

  test('manager writes are blocked when the store owner trial has expired', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue({
      store_id: 3,
      user_id: 9,
      role: 'manager',
      is_active: 1,
    });

    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ store_id: 3, name: '테스트' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TRIAL_EXPIRED');
    expect(mockCategoriesController.createCategory).not.toHaveBeenCalled();
  });

  test('expired trial cannot reorder categories', async () => {
    const response = await request(app)
      .put('/api/categories/sort')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ orders: [{ id: 11, sort_order: 1 }] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TRIAL_EXPIRED');
    expect(mockCategoriesController.updateSortOrders).not.toHaveBeenCalled();
  });

  test('reorder rejects a missing category before checking the store permission', async () => {
    mockPrisma.categories.findMany.mockResolvedValue([]);
    const response = await request(app)
      .put('/api/categories/sort')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ orders: [{ id: 404, sort_order: 1 }] });

    expect(response.status).toBe(404);
    expect(mockCategoriesController.updateSortOrders).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test('expired trial cannot bulk create products', async () => {
    const response = await request(app)
      .post('/api/products/bulk')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ store_id: 3, products: [{ name: '테스트', price: 1000 }] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TRIAL_EXPIRED');
    expect(mockProductsController.bulkCreate).not.toHaveBeenCalled();
  });

  test('expired target trial cannot import products from another store', async () => {
    const response = await request(app)
      .post('/api/products/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ target_store_id: 3, source_store_id: 4 });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TRIAL_EXPIRED');
    expect(mockProductsController.importFromStore).not.toHaveBeenCalled();
  });
});

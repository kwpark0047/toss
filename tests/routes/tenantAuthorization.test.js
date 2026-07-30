const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-tenant-authorization';

const tenantModels = [
  'products',
  'categories',
  'option_templates',
  'orders',
  'notifications',
  'reservations',
  'staff',
  'staff_schedules',
];
const mockPrisma = {
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn(), findUnique: jest.fn() },
};
for (const model of tenantModels) {
  if (!mockPrisma[model]) mockPrisma[model] = {};
  mockPrisma[model].findUnique = mockPrisma[model].findUnique || jest.fn();
  mockPrisma[model].findMany = mockPrisma[model].findMany || jest.fn();
}
jest.mock('../../config/prisma', () => mockPrisma);

const mockOk = jest.fn((_req, res) => res.status(200).json({ ok: true }));
jest.mock('../../controllers/productsController', () => ({
  getStoreProducts: mockOk,
  getProductById: mockOk,
  createProduct: mockOk,
  updateProduct: mockOk,
  deleteProduct: mockOk,
  bulkCreate: mockOk,
  importFromStore: mockOk,
}));
jest.mock('../../controllers/categoriesController', () => ({
  getStoreCategories: mockOk,
  updateSortOrders: mockOk,
  createCategory: mockOk,
  updateCategory: mockOk,
  deleteCategory: mockOk,
  getAllCategories: mockOk,
  getCategoryById: mockOk,
}));
jest.mock('../../controllers/optionTemplatesController', () => ({
  getTemplates: mockOk,
  createTemplate: mockOk,
  updateTemplate: mockOk,
  deleteTemplate: mockOk,
}));
jest.mock('../../controllers/orderController', () => ({
  createOrder: mockOk,
  registerCustomerToken: mockOk,
  getCustomerHistory: mockOk,
  getDetailedStats: mockOk,
  getStats: mockOk,
  getStoreOrders: mockOk,
  getOrderDetails: mockOk,
  updateStatus: mockOk,
  cancelOrder: mockOk,
  deleteOrder: mockOk,
}));
jest.mock('../../controllers/notificationsController', () => ({
  getNotifications: mockOk,
  getUnreadCount: mockOk,
  markAsRead: mockOk,
  markAllAsRead: mockOk,
  deleteNotification: mockOk,
  clearNotifications: mockOk,
  createSystemNotification: mockOk,
  registerToken: mockOk,
}));
jest.mock('../../controllers/reservationsController', () => ({
  register: mockOk,
  getStoreReservations: mockOk,
  updateStatus: mockOk,
  getMyReservations: mockOk,
  cancelReservation: mockOk,
}));
jest.mock('../../controllers/staffController', () => ({
  getMyRole: mockOk,
  getStaffList: mockOk,
  selfRegister: mockOk,
  createStaff: mockOk,
  getAttendance: mockOk,
  clockIn: mockOk,
  clockOut: mockOk,
  updateStaffRole: mockOk,
  deleteStaff: mockOk,
  lookupUser: mockOk,
  addExistingUser: mockOk,
  getSchedules: mockOk,
  createSchedules: mockOk,
  updateSchedule: mockOk,
  deleteSchedule: mockOk,
}));

const mockAIPromptService = {
  listPrompts: jest.fn().mockResolvedValue([]),
  createPrompt: jest.fn(),
  updatePrompt: jest.fn(),
  deactivatePrompt: jest.fn(),
};
jest.mock('../../services/AIPromptService', () => mockAIPromptService);

const routers = {
  products: require('../../routes/products'),
  categories: require('../../routes/categories'),
  options: require('../../routes/optionTemplates'),
  orders: require('../../routes/orders'),
  notifications: require('../../routes/notifications'),
  reservations: require('../../routes/reservations'),
  staff: require('../../routes/staff'),
  prompts: require('../../routes/aiPrompts'),
};

function appFor(name) {
  const app = express();
  app.use(express.json());
  app.use('/', routers[name]);
  app.use((err, _req, res, _next) => res.status(err.statusCode || err.status || 500).json({ error: err.message }));
  return app;
}

const tokenFor = (id, role = 'owner') =>
  jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const OWNER_TOKEN = tokenFor(1);
const OUTSIDER_TOKEN = tokenFor(2);
const ADMIN_TOKEN = tokenFor(99, 'super_admin');

const objectCases = [
  ['products', 'products', 'put', '/10', { name: '수정' }],
  ['categories', 'categories', 'put', '/10', { name: '수정' }],
  ['options', 'option_templates', 'put', '/10', { name: '수정', options: [] }],
  ['orders', 'orders', 'put', '/10/status', { status: 'confirmed' }],
  ['notifications', 'notifications', 'patch', '/10/read', null],
  ['reservations', 'reservations', 'patch', '/10/status', { status: 'CONFIRMED' }],
  ['staff', 'staff', 'put', '/10', { role: 'staff' }],
];

describe('multi-tenant route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
    for (const model of tenantModels) {
      mockPrisma[model].findUnique.mockResolvedValue({ store_id: 42 });
      mockPrisma[model].findMany.mockResolvedValue([]);
    }
  });

  test.each(objectCases)('%s object mutation denies a user from another store', async (route, model, method, path, body) => {
    const call = request(appFor(route))[method](path).set('Authorization', `Bearer ${OUTSIDER_TOKEN}`);
    const response = body ? await call.send(body) : await call;

    expect(response.status).toBe(403);
    expect(mockPrisma[model].findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { store_id: true },
    });
    expect(mockOk).not.toHaveBeenCalled();
  });

  test.each(objectCases)('%s object mutation allows the target store owner', async (route, _model, method, path, body) => {
    const call = request(appFor(route))[method](path).set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const response = body ? await call.send(body) : await call;

    expect(response.status).toBe(200);
    expect(mockOk).toHaveBeenCalled();
  });

  test('direct store private read denies another store and allows its owner', async () => {
    const app = appFor('options');
    const denied = await request(app)
      .get('/store/42')
      .set('Authorization', `Bearer ${OUTSIDER_TOKEN}`);
    const allowed = await request(app)
      .get('/store/42')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  test('mixed-store category sort is rejected before any mutation', async () => {
    mockPrisma.categories.findMany.mockResolvedValue([
      { id: 10, store_id: 42 },
      { id: 11, store_id: 43 },
    ]);

    const response = await request(appFor('categories'))
      .put('/sort')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ orders: [{ id: 10, sort_order: 1 }, { id: 11, sort_order: 2 }] });

    expect(response.status).toBe(400);
    expect(mockOk).not.toHaveBeenCalled();
  });

  test('AI prompt administration is explicitly super_admin only', async () => {
    const app = appFor('prompts');
    const ownerResponse = await request(app)
      .get('/')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const adminResponse = await request(app)
      .get('/')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(ownerResponse.status).toBe(403);
    expect(adminResponse.status).toBe(200);
    expect(mockAIPromptService.listPrompts).toHaveBeenCalledTimes(1);
  });
});

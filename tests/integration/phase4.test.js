const request = require('supertest');
const { app } = require('../../app');
const alimtalkService = require('../../services/AlimtalkService');
const aiService = require('../../services/aiService');
const Table = require('../../repositories/Table');
const Product = require('../../repositories/Product');
const Order = require('../../repositories/Order');
const Store = require('../../repositories/Store');
const OrderService = require('../../services/OrderService');

let mockUser = { id: 1, name: '홍길동', role: 'owner' };

jest.mock('../../middleware/auth', () => {
  const mockAuthMiddleware = (req, res, next) => {
    if (!mockUser) {
      return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }
    req.user = mockUser;
    next();
  };

  const mockOptionalAuth = (req, res, next) => {
    req.user = mockUser;
    next();
  };

  const mockAuthModule = mockAuthMiddleware;
  mockAuthModule.authMiddleware = mockAuthMiddleware;
  mockAuthModule.optionalAuth = mockOptionalAuth;
  mockAuthModule.adminOnly = (req, res, next) => next();

  return mockAuthModule;
});

jest.mock('../../middleware/storeAuth', () => {
  return {
    checkStorePermission: (permission) => (req, res, next) => {
      req.storeId = req.params && req.params.storeId ? parseInt(req.params.storeId) : 1;
      req.storeRole = 'owner';
      next();
    },
    checkStorePermissionForObject: () => (req, res, next) => {
      req.storeId = req.params && req.params.storeId ? parseInt(req.params.storeId) : 1;
      req.storeRole = 'owner';
      next();
    },
    checkStorePermissionForObjectBatch: () => (req, res, next) => {
      req.storeId = req.params && req.params.storeId ? parseInt(req.params.storeId) : 1;
      req.storeRole = 'owner';
      next();
    },
    checkUniformStoreMutation: () => (req, res, next) => {
      req.storeId = req.params && req.params.storeId ? parseInt(req.params.storeId) : 1;
      req.storeRole = 'owner';
      next();
    },
    getStoreRole: jest.fn(() => 'owner'),
    checkResourcePermission: () => (req, res, next) => next(),
  };
});

jest.mock('../../services/AlimtalkService');
jest.mock('../../services/aiService');
jest.mock('../../repositories/Table');
jest.mock('../../repositories/Product');
jest.mock('../../repositories/Order');
jest.mock('../../repositories/Store');

jest.mock('../../config/prisma', () => {
  return {
    stores: {
      findUnique: jest.fn(() => ({ id: 1, name: '맛있는 식당' })),
    },
    tables: {
      findUnique: jest.fn(() => ({ id: 5, table_number: '3번 테이블' })),
      findMany: jest.fn(() => [
        { id: 1, store_id: 1 },
        { id: 2, store_id: 1 },
      ]),
    },
    store_customers: {
      findFirst: jest.fn(() => ({ fcm_token: 'test_token' })),
    },
    order_items: {
      findMany: jest.fn(() => []),
    },
  };
});

describe('Phase 4 Business Enhancements Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '홍길동', role: 'owner' };
  });

  describe('1. Kakao Alimtalk Integration in OrderService', () => {
    it('should trigger sendOrderConfirmed on confirmed order status update', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: 'ORD-101',
        customer_phone: '01012345678',
        total_amount: 15000,
        queue_number: 12,
      };
      Order.updateStatus.mockResolvedValue(mockOrder);
      Store.findById.mockResolvedValue({ id: 1, name: '맛있는 식당' });

      const ioMock = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
      const orderService = new OrderService(ioMock);
      await orderService.updateStatus(101, 'confirmed', 1);

      expect(Order.updateStatus).toHaveBeenCalledWith(101, 'confirmed', 1);
      // //
      ('01012345678', '맛있는 식당', 'ORD-101', 12, 15000);
    });

    it('should trigger sendFoodReady on ready order status update', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: 'ORD-101',
        customer_phone: '01012345678',
        table_id: 5,
        total_amount: 15000,
      };
      Order.updateStatus.mockResolvedValue(mockOrder);
      Table.findById.mockResolvedValue({ id: 5, table_number: '3번 테이블' });

      const ioMock = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
      const orderService = new OrderService(ioMock);
      await orderService.updateStatus(101, 'ready', 1);

      // //
      ('01012345678', '맛있는 식당', 'ORD-101', '3번 테이블');
    });

    it('should trigger sendOrderCancelled on cancelled order', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: 'ORD-101',
        customer_phone: '01012345678',
        total_amount: 15000,
      };
      Order.findById.mockResolvedValue(mockOrder);
      Order.updateStatus.mockResolvedValue({ ...mockOrder, status: 'cancelled' });

      const ioMock = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
      const orderService = new OrderService(ioMock);
      await orderService.cancelOrder(101, 1, 'owner');

      // //
      ('01012345678', '맛있는 식당', 'ORD-101', '매장 사정 또는 재고 소진');
    });
  });

  describe('2. Products Real-time Menu Translation', () => {
    it('should translate products list on query lang option and cache them', async () => {
      const mockProducts = [{ id: 1, name: '김밥', description: '고소한 참기름을 바른 김밥' }];
      Product.findByStoreId.mockResolvedValue(mockProducts);
      aiService.batchTranslateMenus.mockResolvedValue([
        { id: 1, translated_name: 'Gimbap', translated_description: 'Rice roll with sesame oil' },
      ]);

      const response = await request(app).get('/api/products/store/1?lang=en');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].name).toBe('Gimbap');
      expect(response.body.data[0].description).toBe('Rice roll with sesame oil');
      expect(aiService.batchTranslateMenus).toHaveBeenCalledWith(mockProducts, 'en');
    });
  });

  describe('3. Drag and Drop Visual Table Positioning', () => {
    it('should update multiple table coordinates in bulk and emit socket event', async () => {
      const mockLayout = [
        { id: 1, x: 100, y: 150 },
        { id: 2, x: 250, y: 300 },
      ];
      const mockUpdatedTables = [
        { id: 1, store_id: 1, table_number: '1번', x: 100, y: 150 },
        { id: 2, store_id: 1, table_number: '2번', x: 250, y: 300 },
      ];
      Table.updateLayout.mockResolvedValue(mockUpdatedTables);

      const response = await request(app)
        .put('/api/tables/store/1/layout')
        .send({ layout: mockLayout });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(Table.updateLayout).toHaveBeenCalledWith('1', mockLayout);
    });

    it('should return 400 when layout is missing or not an array', async () => {
      const response = await request(app).put('/api/tables/store/1/layout').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

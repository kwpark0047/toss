const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');
const notificationService = require('../../services/notificationService');

let mockUser = { id: 1, name: '장사장', role: 'user' };

// ── 인증 및 권한 미들웨어 모의 ──────────────────────────────────────────────────
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

  const mockAdminOnly = (req, res, next) => {
    if (!mockUser || mockUser.role !== 'super_admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    next();
  };

  const mockAuthModule = mockAuthMiddleware;
  mockAuthModule.authMiddleware = mockAuthMiddleware;
  mockAuthModule.optionalAuth = mockOptionalAuth;
  mockAuthModule.adminOnly = mockAdminOnly;

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

// ── Prisma 데이터베이스 어댑터 모의 ────────────────────────────────────────────────
jest.mock('../../config/prisma', () => {
  return {
    metrics: { create: jest.fn(), aggregate: jest.fn() },
    food_trucks: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    stores: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    products: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orders: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    payments: {
      create: jest.fn(),
    },
    store_customers: {
      findMany: jest.fn(),
    },
    stock_history: {
      create: jest.fn(),
    },
  };
});

// ── 실시간 알림 서비스 모의 ──────────────────────────────────────────────────────
jest.mock('../../services/notificationService', () => {
  return {
    init: jest.fn(),
    sendSocket: jest.fn().mockReturnValue(true),
    sendPush: jest.fn().mockResolvedValue(true),
  };
});

describe('FoodTruck Integration Tests', () => {
  const baseUrl = '/api/foodtruck';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '장사장', role: 'user' };
  });

  describe('GET /active', () => {
    it('should list all active food trucks with store data', async () => {
      prisma.food_trucks.findMany.mockResolvedValue([
        {
          id: 1,
          store_id: 10,
          is_active_session: true,
          latitude: 37.5501,
          longitude: 126.9202,
          geocoded_address: '서울특별시 마포구 홍익로 20 (서교동, 푸드트럭 스트리트)',
          is_sold_out_emergency: false,
          stores: {
            id: 10,
            name: '신촌 닭꼬치 트럭',
            description: '국산 닭을 직화로 굽는 정통 꼬치 맛집!',
          },
        },
      ]);

      const response = await request(app).get(`${baseUrl}/active`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].stores.name).toBe('신촌 닭꼬치 트럭');
      expect(prisma.food_trucks.findMany).toHaveBeenCalledWith({
        where: { is_active_session: true },
        include: { stores: true },
      });
    });
  });

  describe('GET /stores/:storeId', () => {
    it('should return specific food truck status', async () => {
      prisma.food_trucks.findUnique.mockResolvedValue({
        id: 1,
        store_id: 10,
        is_active_session: true,
        latitude: 37.4979,
        longitude: 127.0276,
        geocoded_address: '서울특별시 강남구 강남대로 396 (역삼동, 푸드트럭 존)',
        is_sold_out_emergency: false,
      });

      const response = await request(app).get(`${baseUrl}/stores/10`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active_session).toBe(true);
      expect(response.body.data.latitude).toBe(37.4979);
    });

    it('should return default fallback state if food truck settings not initialized yet', async () => {
      prisma.food_trucks.findUnique.mockResolvedValue(null);

      const response = await request(app).get(`${baseUrl}/stores/999`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.store_id).toBe(999);
      expect(response.body.data.is_active_session).toBe(false);
      expect(response.body.data.geocoded_address).toBeNull();
    });
  });

  describe('POST /stores/:storeId/gps', () => {
    it('should update location and reverse-geocode successfully', async () => {
      prisma.food_trucks.upsert.mockResolvedValue({
        id: 1,
        store_id: 10,
        latitude: 37.5505,
        longitude: 126.9205,
        geocoded_address: '서울특별시 마포구 홍익로 20 (서교동, 푸드트럭 스트리트)',
        last_gps_updated_at: '2026-07-10T22:00:00.000Z',
      });

      const response = await request(app)
        .post(`${baseUrl}/stores/10/gps`)
        .send({ latitude: 37.5505, longitude: 126.9205 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.geocoded_address).toContain('마포구 홍익로 20');
      expect(prisma.food_trucks.upsert).toHaveBeenCalled();
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'food-truck-location-updated',
        expect.any(Object)
      );
    });

    it('should return 400 if coordinates are missing', async () => {
      const response = await request(app)
        .post(`${baseUrl}/stores/10/gps`)
        .send({ latitude: 37.5505 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /stores/:storeId/session', () => {
    it('should toggle active session status successfully', async () => {
      prisma.food_trucks.upsert.mockResolvedValue({
        id: 1,
        store_id: 10,
        is_active_session: true,
      });
      prisma.stores.update.mockResolvedValue({
        id: 10,
        is_active: true,
      });

      const response = await request(app)
        .post(`${baseUrl}/stores/10/session`)
        .send({ is_active_session: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_active_session).toBe(true);
      expect(prisma.stores.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { is_active: true },
      });
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'food-truck-session-changed',
        expect.any(Object)
      );
    });
  });

  describe('POST /stores/:storeId/emergency-soldout', () => {
    it('should trigger emergency sold out across all products', async () => {
      prisma.food_trucks.upsert.mockResolvedValue({
        id: 1,
        store_id: 10,
        is_sold_out_emergency: true,
      });
      prisma.products.updateMany.mockResolvedValue({
        count: 15,
      });

      const response = await request(app)
        .post(`${baseUrl}/stores/10/emergency-soldout`)
        .send({ is_sold_out_emergency: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.products.updateMany).toHaveBeenCalledWith({
        where: { store_id: 10 },
        data: { is_sold_out: true },
      });
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'food-truck-emergency-shutdown',
        expect.any(Object)
      );
    });
  });

  describe('POST /stores/:storeId/ingredient-sold-out', () => {
    it('should mark matching products as sold out', async () => {
      prisma.products.findMany.mockResolvedValue([
        { id: 101, name: '치즈 닭꼬치', ingredients: 'chicken, cheese', is_active: true },
        { id: 102, name: '소금 닭꼬치', ingredients: 'chicken, salt', is_active: true },
      ]);
      prisma.products.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post(`${baseUrl}/stores/10/ingredient-sold-out`)
        .send({ ingredientName: 'cheese' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.products.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [101] } },
        data: { is_sold_out: true },
      });
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'ingredient-sold-out',
        expect.any(Object)
      );
    });

    it('should return 400 if ingredientName is missing', async () => {
      const response = await request(app).post(`${baseUrl}/stores/10/ingredient-sold-out`).send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /stores/:storeId/flash-sale (Scenario D)', () => {
    it('should geofence and trigger flash sale only for near customers', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 10, name: '신촌 닭꼬치 트럭' });
      prisma.food_trucks.findUnique.mockResolvedValue({
        store_id: 10,
        latitude: 37.5501,
        longitude: 126.9202,
        geocoded_address: '서울특별시 마포구 홍익로 20',
      });
      prisma.store_customers.findMany.mockResolvedValue([
        { id: 1, customer_name: '홍길동', customer_phone: '01011112222' }, // Index 0 -> near
        { id: 2, customer_name: '이순신', customer_phone: '01033334444' }, // Index 1 -> far
      ]);

      const response = await request(app).post(`${baseUrl}/stores/10/flash-sale`).send({
        discountPercent: 20,
        message: '마감 반짝 치즈꼬치 세일!',
        radiusMeters: 500,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Index 0은 100m 부근(참값)이므로 targetedCustomers에 포함되어야 함
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('홍길동');
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'customer - 01011112222',
        'flash-sale-alert',
        expect.any(Object)
      );
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'flash-sale-triggered',
        expect.any(Object)
      );
    });

    it('should return 400 if parameters are missing', async () => {
      const response = await request(app)
        .post(`${baseUrl}/stores/10/flash-sale`)
        .send({ discountPercent: 20 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /stores/:storeId/offline-sync (Scenario E)', () => {
    it('should sync offline transactions and deduct inventory', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 10, name: '신촌 닭꼬치 트럭' });
      prisma.orders.findUnique.mockResolvedValue(null); // No duplicates
      prisma.orders.create.mockResolvedValue({
        id: 501,
        order_number: 'OFF-10001',
        created_at: new Date(),
      });
      prisma.products.findUnique.mockResolvedValue({ id: 101, stock_quantity: 10 });
      prisma.products.update.mockResolvedValue({ id: 101, stock_quantity: 8 });

      const offlineTransactions = [
        {
          order_number: 'OFF-10001',
          customer_name: '김오프',
          customer_phone: '01055556666',
          total_amount: 15000,
          method: 'cash',
          created_at: '2026-07-10T15:00:00.000Z',
          items: [
            {
              product_id: 101,
              product_name: '치즈꼬치',
              price: 5000,
              quantity: 2,
              subtotal: 10000,
            },
          ],
        },
      ];

      const response = await request(app)
        .post(`${baseUrl}/stores/10/offline-sync`)
        .send({ offlineTransactions });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.synchronizedCount).toBe(1);
      expect(prisma.orders.create).toHaveBeenCalled();
      expect(prisma.products.update).toHaveBeenCalled();
      expect(prisma.stock_history.create).toHaveBeenCalled();
      expect(notificationService.sendSocket).toHaveBeenCalledWith(
        'store - 10',
        'food-truck-offline-synchronized',
        expect.any(Object)
      );
    });

    it('should skip duplicate orders for idempotency', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 10, name: '신촌 닭꼬치 트럭' });
      prisma.orders.findUnique.mockResolvedValue({ id: 501, order_number: 'OFF-10001' }); // Duplicate order exists

      const offlineTransactions = [
        {
          order_number: 'OFF-10001',
          customer_name: '김오프',
          total_amount: 15000,
          items: [],
        },
      ];

      const response = await request(app)
        .post(`${baseUrl}/stores/10/offline-sync`)
        .send({ offlineTransactions });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.synchronizedCount).toBe(0); // Ignored/Skipped
      expect(prisma.orders.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /stores/:storeId/analytics (Step 2)', () => {
    it('should compile peak hour, daily sales, location shares, and return Gemini consulting insights', async () => {
      // Mock orders for stats compilation
      prisma.orders.findMany.mockResolvedValue([
        { id: 1, total_amount: 10000, created_at: new Date('2026-07-10T18:30:00.000Z') },
        { id: 2, total_amount: 20000, created_at: new Date('2026-07-10T19:45:00.000Z') },
      ]);

      const response = await request(app).get(`${baseUrl}/stores/10/analytics`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hourlySales).toHaveLength(24);
      expect(response.body.data.dailySales).toHaveLength(7);
      expect(response.body.data.locationSales).toHaveLength(4);
      expect(response.body.data.totalSales).toBe(30000);
      expect(response.body.data.aiInsights).toHaveProperty('summary');
      expect(response.body.data.aiInsights).toHaveProperty('peakAdvice');
      expect(response.body.data.aiInsights).toHaveProperty('inventoryStrategy');
    });
  });
});

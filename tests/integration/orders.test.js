// ── 모의 객체 선언 (jest.mock 팩토리가 참조하므로 최상단에서 먼저 초기화) ──────────
const mockOrderRepository = {
  findById: jest.fn(),
  findByCustomer: jest.fn(),
  findByStoreId: jest.fn(),
  getStats: jest.fn(),
  getDetailedStats: jest.fn(),
  delete: jest.fn(),
  findByIdWithItems: jest.fn(),
};

const mockOrderServiceInstance = {
  createOrder: jest.fn(),
  updateStatus: jest.fn(),
  cancelOrder: jest.fn(),
  deleteOrder: jest.fn(),
};

const mockPreferenceServiceInstance = {
  getPersonalizedRecommendations: jest.fn().mockResolvedValue([]),
  toggleFavorite: jest.fn().mockResolvedValue({ success: true }),
  learnFromOrder: jest.fn().mockResolvedValue(undefined),
  getProfile: jest
    .fn()
    .mockResolvedValue({ preferred_categories: [], preferred_tastes: [], favorite_items: [] }),
  getStoreStats: jest.fn().mockResolvedValue({
    top_categories: [],
    top_tastes: [],
    avg_spicy_tolerance: 1,
    price_sensitivity_dist: {},
    total_customers: 0,
  }),
};

const mockWaitingServiceInstance = {
  getStoreStatus: jest.fn().mockResolvedValue(0),
  getStoreWaitingList: jest.fn().mockResolvedValue([]),
  register: jest.fn().mockResolvedValue({}),
  updateStatus: jest.fn().mockResolvedValue({}),
  resendNotification: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getMyWaiting: jest.fn().mockResolvedValue([]),
  getAISuggestions: jest.fn().mockResolvedValue({ suggestions: [], source: 'ai' }),
};

let mockUser = { id: 1, name: '장사장', role: 'user' };

// 테스트 전체 타임아웃 확대 (Basic Authorization 등 처리 지연 방지)
jest.setTimeout(15000);

const request = require('supertest');

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

// ── 매장 권한 미들웨어 모의 ──────────────────────────────────────────────────
jest.mock('../../middleware/storeAuth', () => ({
  checkStorePermission: (permission) => (req, res, next) => {
    req.storeId = parseInt(
      req.params.storeId || req.query.store_id || (req.body && req.body.store_id) || 1
    );
    req.storeRole = 'owner';
    next();
  },
  checkStorePermissionForObject: () => (req, res, next) => {
    req.storeId = parseInt(
      req.params.storeId || req.query.store_id || (req.body && req.body.store_id) || 1
    );
    req.storeRole = 'owner';
    next();
  },
  checkStorePermissionForObjectBatch: () => (req, res, next) => {
    req.storeId = parseInt(
      req.params.storeId || req.query.store_id || (req.body && req.body.store_id) || 1
    );
    req.storeRole = 'owner';
    next();
  },
  checkUniformStoreMutation: () => (req, res, next) => {
    req.storeId = parseInt(
      req.params.storeId || req.query.store_id || (req.body && req.body.store_id) || 1
    );
    req.storeRole = 'owner';
    next();
  },
  getStoreRole: jest.fn().mockResolvedValue('owner'),
  checkResourcePermission: () => (req, res, next) => next(),
  checkOrderPermission: () => (req, res, next) => {
    req.orderStoreId = 1;
    next();
  },
}));

// ── 검증 미들웨어 모의 (실제 Joi 검증 수행, 테스트 신뢰성 확보) ──────────────────
jest.mock('../../middleware/validate', () => {
  const Joi = require('joi');
  const validate = (schema) => (req, res, next) => {
    if (Joi.isSchema(schema)) {
      const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) {
        const errorMessage = error.details.map((d) => d.message).join(', ');
        return res
          .status(400)
          .json({ error: 'Validation Error', message: errorMessage, details: error.details });
      }
      req.body = value;
      return next();
    }
    const validations = [];
    if (schema.body) validations.push({ type: 'body', data: req.body, schema: schema.body });
    if (schema.query) validations.push({ type: 'query', data: req.query, schema: schema.query });
    if (schema.params)
      validations.push({ type: 'params', data: req.params, schema: schema.params });
    for (const v of validations) {
      const { error, value } = v.schema.validate(v.data, { abortEarly: false, stripUnknown: true });
      if (error) {
        const errorMessage = error.details.map((d) => d.message).join(', ');
        return res.status(400).json({
          error: `Validation Error (${v.type})`,
          message: errorMessage,
          details: error.details,
        });
      }
      req[v.type] = value;
    }
    next();
  };
  return validate;
});

// ── Order 레포지토리 모의 ─────────────────────
jest.mock('../../repositories/Order', () => mockOrderRepository);

// ── OrderService 모의 (인스턴스는 파일 최상단에서 선언됨) ───────────────────
jest.mock('../../services/OrderService', () => {
  return jest.fn().mockImplementation(() => mockOrderServiceInstance);
});

// ── CustomerPreferenceService 모의 (singleton instance export) ────────────────
jest.mock('../../services/CustomerPreferenceService', () => mockPreferenceServiceInstance);

// ── WaitingService 모의 ───────────────────────────────────────────────────────
jest.mock('../../services/WaitingService', () => {
  return jest.fn().mockImplementation(() => mockWaitingServiceInstance);
});

// ── Prisma 모의 (기존 customer-token 테스트용) ─────────────────────────────────
jest.mock('../../config/prisma', () => {
  return {
    orders: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    store_customers: {
      updateMany: jest.fn(),
    },
  };
});

// App을 지연 로드 (모든 모의가 설정된 후)
let app;
const getApp = () => {
  if (!app) {
    app = require('../../app').app;
  }
  return app;
};

describe('Orders Integration Tests', () => {
  const baseUrl = '/api/orders';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '장사장', role: 'user' };
    Object.values(mockOrderServiceInstance).forEach((fn) => fn.mockReset?.());
  });

  describe('GET /orders/:id - 주문 단일 상세 조회', () => {
    it('should return order details when found', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: '20260720-0001',
        status: 'confirmed',
        total_amount: 25000,
        items: [
          { id: 1, product_id: 10, quantity: 2, product: { name: '아메리카노', price: 4500 } },
        ],
        created_at: '2026-07-20T10:00:00.000Z',
      };
      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      const res = await request(getApp()).get(`${baseUrl}/101`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(101);
      expect(res.body.data.order_number).toBe('20260720-0001');
      expect(mockOrderRepository.findById).toHaveBeenCalledWith('101');
    });
  });

  describe('GET /orders/store/:storeId - 매장별 주문 목록 조회', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        {
          id: 1,
          store_id: 1,
          order_number: '20260720-0001',
          status: 'completed',
          total_amount: 15000,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          store_id: 1,
          order_number: '20260720-0002',
          status: 'pending',
          total_amount: 20000,
          created_at: new Date().toISOString(),
        },
      ];
      mockOrderRepository.findByStoreId.mockResolvedValue({
        items: mockOrders,
        total: 2,
        page: 1,
        limit: 10,
      });
      mockOrderRepository.getStats.mockResolvedValue({
        total: 2,
        pending: 1,
        completed: 1,
        confirmed: 0,
      });

      const res = await request(getApp())
        .get(`${baseUrl}/store/1`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe('GET /orders/store/:storeId/stats - 매장별 통계 조회', () => {
    it('should return store stats', async () => {
      const mockStats = {
        today_sales: 100000,
        today_orders: 50,
        this_month_sales: 3000000,
        this_month_orders: 1500,
      };
      mockOrderRepository.getStats.mockResolvedValue(mockStats);

      const res = await request(getApp()).get(`${baseUrl}/store/1/stats`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.today_sales).toBe(100000);
    });
  });

  describe('POST /orders - 주문 생성', () => {
    it('should create order successfully', async () => {
      const newOrder = {
        id: 3,
        store_id: 1,
        order_number: '20260720-0003',
        status: 'pending',
        total_amount: 10000,
      };
      mockOrderServiceInstance.createOrder.mockResolvedValue(newOrder);

      const res = await request(getApp())
        .post(`${baseUrl}`)
        .send({
          store_id: 1,
          items: [
            {
              product_id: 5,
              product_name: '아메리카노',
              quantity: 1,
              price: 10000,
              subtotal: 10000,
            },
          ],
          total_amount: 10000,
          payment_method: 'card',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(3);
    });
  });

  describe('PUT /orders/:id/status - 주문 상태 변경', () => {
    it('should update order status', async () => {
      const updatedOrder = { id: 1, status: 'confirmed', updated_at: new Date().toISOString() };
      mockOrderServiceInstance.updateStatus.mockResolvedValue(updatedOrder);

      const res = await request(getApp())
        .put(`${baseUrl}/1/status`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.order.status).toBe('confirmed');
    });
  });

  describe('POST /orders/:id/cancel - 주문 취소', () => {
    it('should cancel order', async () => {
      mockOrderServiceInstance.cancelOrder.mockResolvedValue({
        success: true,
        message: '주문이 취소되었습니다',
      });

      const res = await request(getApp()).post(`${baseUrl}/1/cancel`).expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /orders/:id - 주문 삭제', () => {
    it('should delete order', async () => {
      mockOrderServiceInstance.deleteOrder.mockResolvedValue({
        success: true,
        message: '주문이 삭제되었습니다',
      });

      const res = await request(getApp()).delete(`${baseUrl}/1`).expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});

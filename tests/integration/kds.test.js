const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');
const AlimtalkService = require('../../services/AlimtalkService');

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
  };
});

// ── 전화번호 복호화 모듈 모의 ──────────────────────────────────────────────────
jest.mock('../../utils/phoneEncryption', () => {
  return {
    decryptPhone: jest.fn(() => '01012345678'),
    phoneSearchCandidates: jest.fn(() => ['01012345678']),
  };
});

// ── Prisma 데이터베이스 어댑터 모의 ────────────────────────────────────────────────
jest.mock('../../config/prisma', () => {
  const mockPrisma = {
    orders: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    print_jobs: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };
  return mockPrisma;
});

// ── 알림톡 서비스 모의 ──────────────────────────────────────────────────────
jest.mock('../../services/AlimtalkService', () => {
  return {
    sendFoodReady: jest.fn().mockResolvedValue({ sent: true }),
  };
});

describe('KDS Integration Tests', () => {
  const storeId = 1;
  const baseUrl = `/api/kds/stores/${storeId}`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '장사장', role: 'user' };
  });

  describe('GET /stores/:storeId/orders', () => {
    it('should fetch active KDS orders in pending, preparing, or ready status', async () => {
      prisma.orders.findMany.mockResolvedValue([
        {
          id: 101,
          store_id: 1,
          order_number: '20260711-0001',
          status: 'pending',
          total_amount: 15000,
          order_items: [{ id: 201, product_name: '수제 팥빙수', quantity: 2, price: 7500 }],
          tables: { table_number: '12' },
          stores: { name: '연남 디저트 카페' },
        },
      ]);

      const res = await request(app).get(`${baseUrl}/orders`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(101);
      expect(res.body.data[0].table_name).toBe('12');
      expect(res.body.data[0].store_name).toBe('연남 디저트 카페');
      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            store_id: 1,
            status: expect.objectContaining({ in: ['pending', 'preparing', 'ready'] }),
          }),
        })
      );
    });
  });

  describe('POST /stores/:storeId/orders/:orderId/status', () => {
    it('should fail if status parameter is missing', async () => {
      const res = await request(app).post(`${baseUrl}/orders/101/status`).send({}).expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('상태(status)는 필수입니다.');
    });

    it('should fail for an invalid status transition', async () => {
      const res = await request(app)
        .post(`${baseUrl}/orders/101/status`)
        .send({ status: 'invalid_status_code' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('올바르지 않은 KDS 조리 상태 코드입니다.');
    });

    it('should transition status to preparing and generate a kitchen print job', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: '20260711-0001',
        status: 'pending',
        total_amount: 15000,
        created_at: new Date().toISOString(),
        order_items: [
          { id: 201, product_name: '수제 팥빙수', quantity: 2, price: 7500, options: null },
        ],
        tables: { table_number: '12' },
        stores: { name: '연남 디저트 카페' },
      };

      prisma.orders.findUnique.mockResolvedValue(mockOrder);
      prisma.orders.update.mockResolvedValue({
        ...mockOrder,
        status: 'preparing',
      });

      const res = await request(app)
        .post(`${baseUrl}/orders/101/status`)
        .send({ status: 'preparing' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('preparing');
      expect(prisma.print_jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            store_id: 1,
            order_id: 101,
            kind: 'kitchen',
            status: 'pending',
            payload_b64: expect.any(String),
          }),
        })
      );
    });

    it('should transition status to ready and dispatch a Kakao Alimtalk pick-up request', async () => {
      const mockOrder = {
        id: 101,
        store_id: 1,
        order_number: '20260711-0001',
        customer_phone: 'U2FsdGVkX1+WqK4pS0+k7A==', // 복호화될 더미 번호
        status: 'preparing',
        total_amount: 15000,
        created_at: new Date().toISOString(),
        order_items: [
          { id: 201, product_name: '수제 팥빙수', quantity: 2, price: 7500, options: null },
        ],
        tables: { table_number: '12' },
        stores: { name: '연남 디저트 카페' },
      };

      prisma.orders.findUnique.mockResolvedValue(mockOrder);
      prisma.orders.update.mockResolvedValue({
        ...mockOrder,
        status: 'ready',
      });

      const res = await request(app)
        .post(`${baseUrl}/orders/101/status`)
        .send({ status: 'ready' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');

      // setImmediate 기반 비동기 알림톡 동작 검증을 위한 짧은 지연 처리
      await new Promise((resolve) => setImmediate(resolve));

      expect(AlimtalkService.sendFoodReady).toHaveBeenCalledWith(
        '01012345678',
        '연남 디저트 카페',
        '20260711-0001',
        '12'
      );
    });
  });
});

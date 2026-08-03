const request = require('supertest');
const { app } = require('../../app');
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
  mockAuthModule.authModule = mockAuthMiddleware;
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

// ── AlimtalkService 모의 ──────────────────────────────────────────────────────
jest.mock('../../services/AlimtalkService', () => {
  return {
    getHistoryLogs: jest.fn().mockResolvedValue({
      summary: { total: 10, success: 8, fallback: 2, total_cost: 220 },
      logs: [
        {
          id: 1,
          phone: '01012345678',
          templateId: 'food_ready',
          text: '조리 완료',
          simulated: true,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  };
});

describe('Alimtalk Delivery Console Integration Tests', () => {
  const storeId = 1;
  const baseUrl = `/api/alimtalk/stores/${storeId}`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, name: '장사장', role: 'user' };
  });

  describe('GET /stores/:storeId/history', () => {
    it('should fetch Alimtalk logs and cost aggregates for the store', async () => {
      const res = await request(app).get(`${baseUrl}/history`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.total).toBe(10);
      expect(res.body.data.summary.total_cost).toBe(220);
      expect(res.body.data.logs).toHaveLength(1);
      expect(res.body.data.logs[0].phone).toBe('01012345678');
      expect(AlimtalkService.getHistoryLogs).toHaveBeenCalledWith(1);
    });
  });
});

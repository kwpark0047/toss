/**
 * 스토어 사업자 정보/정산 계좌 엔드포인트 인가 테스트
 *
 * 검증 대상:
 * - GET/PUT /api/stores/{id}/business  → settings:read / settings:write
 * - GET/PUT /api/stores/{id}/account   → settings:read / settings:write
 *
 * 역할별 기대 동작 (storeAuth.js rolePermissions 기준):
 * - owner: 권한 체크 바이패스 → 모두 200
 * - manager: settings:read/write 명시적 보유 → 모두 200
 * - staff: 권한 없음 → 403
 * - kitchen: 권한 없음 → 403
 * - super_admin: 무조건 통과 → 모두 200
 * - 비인증: 401
 * - 타 매장 접근: 403
 * - 존재하지 않는 매장: 403
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-store-business-account';

// ── 공통 목 ────────────────────────────────────────────────────────
const mockPrisma = {
  $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  stores: { findUnique: jest.fn().mockResolvedValue(null) },
  staff: { findFirst: jest.fn().mockResolvedValue(null) },
  store_business_info: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
  store_accounts: {
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
};
jest.mock('../../config/prisma', () => mockPrisma);

// 라우터에서 사용하는 서비스도 목 처리 (DB 접근 차단)
// storeController가 `new StoreService()`로 인스턴스 생성하므로 클래스 mock 필요
const mockStoreService = {
  getBusinessInfo: jest.fn().mockResolvedValue({}),
  updateBusinessInfo: jest.fn().mockResolvedValue({}),
  getAccount: jest.fn().mockResolvedValue({}),
  upsertAccount: jest.fn().mockResolvedValue({}),
  validateBusinessInfo: jest.fn().mockReturnValue(null),
};
jest.mock('../../services/StoreService', () => {
  return jest.fn().mockImplementation(() => mockStoreService);
});

// Store 리포지토리도 mock 필요 (service가 내부에서 사용)
const mockStoreRepo = {
  findBusinessInfo: jest.fn().mockResolvedValue({}),
  findAccount: jest.fn().mockResolvedValue({}),
  findPublicAccount: jest.fn().mockResolvedValue({}),
  updateBusinessInfo: jest.fn().mockResolvedValue({}),
  upsertAccount: jest.fn().mockResolvedValue({}),
};
jest.mock('../../repositories/Store', () => mockStoreRepo);

/** 라우터를 최소 Express 앱에 마운트한다 */
function mountApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  // responseFormatter 미들웨어 추가 (res.success 등 제공)
  app.use((req, res, next) => {
    res.success = (data, message = 'Success', statusCode = 200) => {
      res.status(statusCode).json({ success: true, status: 'success', message, data });
    };
    res.created = (data, message = 'Created') => {
      res.status(201).json({ success: true, status: 'success', message, data });
    };
    next();
  });
  app.use(mountPath, router);
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

/** JWT 발급 헬퍼 */
const tokenFor = (payload, options = {}) =>
  jwt.sign({ type: 'access', ...payload }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });

// 역할별 토큰
const OWNER_TOKEN = tokenFor({ id: 1, role: 'owner' });
const MANAGER_TOKEN = tokenFor({ id: 2, role: 'manager' });
const STAFF_TOKEN = tokenFor({ id: 3, role: 'staff' });
const KITCHEN_TOKEN = tokenFor({ id: 4, role: 'kitchen' });
const SUPER_ADMIN_TOKEN = tokenFor({ id: 99, role: 'super_admin' });
const NO_STORE_USER_TOKEN = tokenFor({ id: 999, role: 'owner' }); // 매장 없는 유저

const STORE_ID = 42;
const ANOTHER_STORE_ID = 999;

describe('스토어 사업자 정보/정산 계좌 라우트 인가', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 mock: 매장 소유자(OWNER_TOKEN 사용자 id=1)가 STORE_ID(42) 소유자
    const defaultStore = {
      id: STORE_ID,
      user_id: 1,
      name: '테스트 매장',
      business_number: '123-45-67890',
      business_name: '테스트 사업체',
      ceo_name: '홍길동',
      tax_invoice_email: 'test@example.com',
      settlement_cycle: 'weekly',
      commission_rate: 0,
      vat_rate: 10,
      enabled_payment_methods: '["cash","card"]',
      theme: null,
      store_accounts: [
        {
          bank_code: '004',
          bank_name: 'KB국민은행',
          account_number: '1234567890',
          account_holder: '홍길동',
          is_active: true,
        },
      ],
    };

    mockPrisma.stores.findUnique.mockResolvedValue(defaultStore);

    // 직원 조회: 기본적으로 null (권한 없음)
    mockPrisma.staff.findFirst.mockResolvedValue(null);

    // 사업자 정보/계좌 mock (기존 테이블 기반)
    mockPrisma.store_business_info.findUnique.mockResolvedValue({
      id: 1,
      store_id: STORE_ID,
      ceo_name: '홍길동',
      business_number: '123-45-67890',
    });
    mockPrisma.store_business_info.upsert.mockResolvedValue({
      id: 1,
      store_id: STORE_ID,
      ceo_name: '홍길동',
      business_number: '123-45-67890',
    });
    mockPrisma.store_accounts.findFirst.mockResolvedValue({
      id: 1,
      store_id: STORE_ID,
      bank_code: '004',
      bank_name: 'KB국민은행',
      account_number: '1234567890',
      account_holder: '홍길동',
      is_default: true,
    });
    mockPrisma.store_accounts.upsert.mockResolvedValue({
      id: 1,
      store_id: STORE_ID,
      bank_code: '004',
      bank_name: 'KB국민은행',
      account_number: '1234567890',
      account_holder: '홍길동',
      is_default: true,
    });
  });

  const app = mountApp('/api/stores', require('../../routes/stores'));

  // ──────────────────────────────────────────────────────────────
  // 공통 테스트 헬퍼
  // ──────────────────────────────────────────────────────────────
  const endpoints = [
    {
      method: 'get',
      path: `/api/stores/${STORE_ID}/business`,
      permission: 'settings:read',
      label: 'GET /business (조회)',
    },
    {
      method: 'put',
      path: `/api/stores/${STORE_ID}/business`,
      permission: 'settings:write',
      label: 'PUT /business (수정)',
      body: { ceoName: '홍길동', businessNumber: '123-45-67890' },
    },
    {
      method: 'get',
      path: `/api/stores/${STORE_ID}/account`,
      permission: 'settings:read',
      label: 'GET /account (조회)',
    },
  ];

  for (const ep of endpoints) {
    describe(`${ep.label}`, () => {
      const makeRequest = (token, storeId = STORE_ID) => {
        const path = ep.path.replace(STORE_ID, storeId);
        const req = request(app)[ep.method](path);
        if (token) req.set('Authorization', `Bearer ${token}`);
        if (ep.body) req.send(ep.body);
        return req;
      };

      test('무인증 접근 시 401', async () => {
        const res = await makeRequest(null);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('인증 토큰이 필요합니다.');
      });

      test('owner(매장 소유자) → 200 (권한 바이패스)', async () => {
        const res = await makeRequest(OWNER_TOKEN);
        expect(res.status).toBe(200);
      });

      test('manager → 200 (settings:read/write 명시적 보유)', async () => {
        mockPrisma.staff.findFirst.mockResolvedValueOnce({
          store_id: STORE_ID,
          user_id: 2,
          role: 'manager',
          is_active: 1,
        });
        const res = await makeRequest(MANAGER_TOKEN);
        expect(res.status).toBe(200);
      });

      test('staff → 403 (권한 없음)', async () => {
        mockPrisma.staff.findFirst.mockResolvedValueOnce({
          store_id: STORE_ID,
          user_id: 3,
          role: 'staff',
          is_active: 1,
        });
        const res = await makeRequest(STAFF_TOKEN);
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('권한이 부족합니다');
      });

      test('kitchen → 403 (권한 없음)', async () => {
        mockPrisma.staff.findFirst.mockResolvedValueOnce({
          store_id: STORE_ID,
          user_id: 4,
          role: 'kitchen',
          is_active: 1,
        });
        const res = await makeRequest(KITCHEN_TOKEN);
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('권한이 부족합니다');
      });

      test('super_admin → 200 (무조건 통과)', async () => {
        const res = await makeRequest(SUPER_ADMIN_TOKEN);
        expect(res.status).toBe(200);
      });

      test('존재하지 않는 매장 접근 → 403', async () => {
        mockPrisma.stores.findUnique.mockResolvedValueOnce(null);
        const res = await makeRequest(OWNER_TOKEN, 99999);
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('권한이 없거나 존재하지 않는 매장');
      });

      test('타 매장(본인 소유 아님, 직원 아님) 접근 → 403', async () => {
        mockPrisma.stores.findUnique.mockResolvedValueOnce({ id: STORE_ID, user_id: 1 });
        mockPrisma.staff.findFirst.mockResolvedValueOnce(null);
        const res = await makeRequest(NO_STORE_USER_TOKEN);
        expect(res.status).toBe(403);
      });
    });
  }
});

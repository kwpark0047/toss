/**
 * GET /api/stores/:id/location/search 인가 테스트
 * - store:update 권한(owner/manager/super_admin)만 허용, staff·타 매장·비인증 거부
 */
const express = require('express');
jest.mock('../../services/AuthSessionService', () => ({
  verifyAccess: jest.fn(async (decoded) => decoded),
}));
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-store-location-search';

const mockPrisma = {
  $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);
jest.mock('../../services/StoreService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../repositories/Store', () => ({}));

const mockGeocode = {
  isConfigured: jest.fn(() => true),
  searchAddresses: jest.fn(async () => [
    { roadAddress: '서울 중구 세종대로 110', lat: 37.566317, lng: 126.977829, source: 'kakao' },
  ]),
  GeocodeProviderError: class GeocodeProviderError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
};
jest.mock('../../services/geocodeService', () => mockGeocode);

function mountApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.success = (data, message = 'Success', statusCode = 200) =>
      res.status(statusCode).json({ success: true, message, data });
    next();
  });
  app.use('/api/stores', require('../../routes/stores'));
  app.use((err, req, res, _next) =>
    res.status(err.statusCode || err.status || 500).json({ error: err.message })
  );
  return app;
}

const tokenFor = (payload) =>
  jwt.sign({ type: 'access', ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' });
const STORE_ID = 42;
const url = (q = '세종대로 110') =>
  `/api/stores/${STORE_ID}/location/search?q=${encodeURIComponent(q)}`;

describe('매장 위치 주소 검색 인가', () => {
  const app = mountApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.stores.findUnique.mockResolvedValue({
      id: STORE_ID,
      user_id: 1,
      name: '테스트 매장',
    });
    mockPrisma.staff.findFirst.mockResolvedValue(null);
  });

  test('비인증 → 401', async () => {
    const res = await request(app).get(url());
    expect(res.status).toBe(401);
    expect(mockGeocode.searchAddresses).not.toHaveBeenCalled();
  });

  test('매장 소유자 → 200, 후보 반환', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'owner' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].roadAddress).toBe('서울 중구 세종대로 110');
    expect(mockGeocode.searchAddresses).toHaveBeenCalledWith('세종대로 110');
  });

  test('manager → 200', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue({
      store_id: STORE_ID,
      user_id: 2,
      role: 'manager',
      is_active: 1,
    });
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${tokenFor({ id: 2, role: 'manager' })}`);
    expect(res.status).toBe(200);
  });

  test('staff → 403', async () => {
    mockPrisma.staff.findFirst.mockResolvedValue({
      store_id: STORE_ID,
      user_id: 3,
      role: 'staff',
      is_active: 1,
    });
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${tokenFor({ id: 3, role: 'staff' })}`);
    expect(res.status).toBe(403);
    expect(mockGeocode.searchAddresses).not.toHaveBeenCalled();
  });

  test('다른 매장 소유자 → 403', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${tokenFor({ id: 999, role: 'owner' })}`);
    expect(res.status).toBe(403);
  });

  test('검색어 1자 → 400', async () => {
    const res = await request(app)
      .get(url('a'))
      .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'owner' })}`);
    expect(res.status).toBe(400);
  });

  test('프로바이더 쿼터 초과 → 429 전달', async () => {
    mockGeocode.searchAddresses.mockRejectedValueOnce(
      new mockGeocode.GeocodeProviderError('요청이 많아요', 429)
    );
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'owner' })}`);
    expect(res.status).toBe(429);
  });

  test('ordinary store requests keep provider diagnostic details private', async () => {
    const error = new mockGeocode.GeocodeProviderError('인증 오류', 503);
    error.providerDiagnostic = {
      provider: 'kakao',
      upstreamStatus: 403,
      upstreamMessage: 'disabled service',
    };
    mockGeocode.searchAddresses.mockRejectedValueOnce(error);
    const res = await request(app)
      .get(url())
      .set('X-Location-Diagnostic', 'kakao-auth-incident')
      .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'owner' })}`);
    expect(res.status).toBe(424);
    expect(res.body).toEqual({ success: false, error: '인증 오류' });
  });

  test('authorized test-store request can retrieve the same redacted runtime log event', async () => {
    mockPrisma.stores.findUnique.mockResolvedValue({ id: 3, user_id: 1 });
    const error = new mockGeocode.GeocodeProviderError('인증 오류', 503);
    error.providerDiagnostic = {
      provider: 'kakao',
      upstreamStatus: 403,
      upstreamMessage: 'disabled service',
    };
    mockGeocode.searchAddresses.mockRejectedValueOnce(error);
    const logger = require('../../utils/logger');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const res = await request(app)
        .get('/api/stores/3/location/search?q=cityhall')
        .set('X-Location-Diagnostic', 'kakao-auth-incident')
        .set('Authorization', `Bearer ${tokenFor({ id: 1, role: 'owner' })}`);
      expect(res.status).toBe(424);
      expect(res.body.diagnostic).toMatchObject(error.providerDiagnostic);
      expect(warn).toHaveBeenCalledWith('[GeocodeAuthDiagnostic]', res.body.diagnostic);
    } finally {
      warn.mockRestore();
    }
  });

  test('diagnostic header does not bypass authentication', async () => {
    const res = await request(app)
      .get('/api/stores/3/location/search?q=cityhall')
      .set('X-Location-Diagnostic', 'kakao-auth-incident');
    expect(res.status).toBe(401);
    expect(res.body.diagnostic).toBeUndefined();
    expect(mockGeocode.searchAddresses).not.toHaveBeenCalled();
  });
});

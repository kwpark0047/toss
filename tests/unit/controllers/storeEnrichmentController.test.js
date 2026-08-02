jest.mock('../../../config/prisma', () => ({ stores: {} }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));
jest.mock('../../../services/naverLocalService', () => ({
  isConfigured: jest.fn(),
  configStatus: jest.fn(() => ({ configured: false, missing: ['NAVER_CLIENT_SECRET'] })),
}));
jest.mock('../../../services/seoulDataService', () => ({
  isConfigured: jest.fn(),
  configStatus: jest.fn(() => ({ configured: true, keyCount: 2, missing: [] })),
}));
jest.mock('../../../services/geocodeService', () => ({
  isConfigured: jest.fn(() => true),
  provider: jest.fn(() => 'ncp'),
  configStatus: jest.fn(() => ({
    configured: true,
    provider: 'ncp',
    availableProviders: ['ncp'],
    missing: [],
  })),
}));

const controller = require('../../../controllers/storeEnrichmentController');

describe('storeEnrichmentController.getStatus', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NAVER_CLIENT_ID = 'client-id';
    delete process.env.NAVER_CLIENT_SECRET;
    process.env.SEOUL_OPENAPI_KEYS = 'first, second, ';
    delete process.env.KAKAO_REST_API_KEY;
    delete process.env.NCP_GEOCODE_KEY_ID;
    delete process.env.NCP_GEOCODE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('비밀값 없이 공급자별 가용성을 반환한다', async () => {
    const res = { success: jest.fn() };

    await controller.getStatus({}, res, jest.fn());

    expect(res.success).toHaveBeenCalledTimes(1);
    const payload = res.success.mock.calls[0][0];
    expect(payload.providers.naver).toMatchObject({ configured: false });
    expect(payload.providers.seoul).toMatchObject({ configured: true, keyCount: 2 });
    expect(payload.providers.geocoding).toMatchObject({ configured: true });
    expect(payload.providers.geocoding.availableProviders).toEqual(['ncp']);
    expect(JSON.stringify(payload)).not.toContain('secret-value');
  });
});

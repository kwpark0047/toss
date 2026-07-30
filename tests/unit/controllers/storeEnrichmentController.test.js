jest.mock('../../../config/prisma', () => ({ stores: {} }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));
jest.mock('../../../services/naverLocalService', () => ({
  configStatus: jest.fn(() => ({ configured: false, missing: ['NAVER_CLIENT_SECRET'] })),
  isConfigured: jest.fn(() => false),
}));
jest.mock('../../../services/seoulDataService', () => ({
  configStatus: jest.fn(() => ({ configured: true, keyCount: 2, missing: [] })),
  isConfigured: jest.fn(() => true),
}));
jest.mock('../../../services/geocodeService', () => ({
  configStatus: jest.fn(() => ({
    configured: true,
    provider: 'ncp',
    availableProviders: ['ncp'],
    missing: [],
  })),
  isConfigured: jest.fn(() => true),
}));

const controller = require('../../../controllers/storeEnrichmentController');

describe('storeEnrichmentController.getStatus', () => {
  test('비밀값 없이 공급자별 가용성을 반환한다', async () => {
    const res = { success: jest.fn() };

    await controller.getStatus({}, res, jest.fn());

    expect(res.success).toHaveBeenCalledTimes(1);
    const payload = res.success.mock.calls[0][0];
    expect(payload.partialExecution).toBe(true);
    expect(payload.providers.naver).toMatchObject({ configured: false });
    expect(payload.providers.seoul).toMatchObject({ configured: true, keyCount: 2 });
    expect(payload.providers.geocoding).toMatchObject({ provider: 'ncp' });
    expect(JSON.stringify(payload)).not.toContain('secret-value');
  });
});

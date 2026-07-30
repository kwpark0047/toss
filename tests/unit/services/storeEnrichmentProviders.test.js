jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const naverLocal = require('../../../services/naverLocalService');
const seoulData = require('../../../services/seoulDataService');
const geocode = require('../../../services/geocodeService');

describe('store enrichment provider configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    delete process.env.SEOUL_OPENAPI_KEYS;
    delete process.env.KAKAO_REST_API_KEY;
    delete process.env.NCP_GEOCODE_KEY_ID;
    delete process.env.NCP_GEOCODE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('네이버 누락 환경변수를 정확히 반환한다', () => {
    process.env.NAVER_CLIENT_ID = 'client-id';

    expect(naverLocal.configStatus()).toEqual({
      configured: false,
      missing: ['NAVER_CLIENT_SECRET'],
    });
  });

  test('서울 API 키 개수와 설정 상태를 반환한다', () => {
    process.env.SEOUL_OPENAPI_KEYS = 'first, second, ';

    expect(seoulData.configStatus()).toEqual({
      configured: true,
      keyCount: 2,
      missing: [],
    });
  });

  test('불완전한 NCP 키 쌍을 진단한다', () => {
    process.env.NCP_GEOCODE_KEY_ID = 'ncp-id';

    expect(geocode.configStatus()).toMatchObject({
      configured: false,
      ncpConfigured: false,
      ncpIncomplete: true,
    });
  });

  test('카카오 호출이 실패하면 설정된 NCP로 대체한다', async () => {
    process.env.KAKAO_REST_API_KEY = 'kakao-key';
    process.env.NCP_GEOCODE_KEY_ID = 'ncp-id';
    process.env.NCP_GEOCODE_KEY = 'ncp-key';
    axios.get
      .mockRejectedValueOnce(new Error('Kakao address unavailable'))
      .mockRejectedValueOnce(new Error('Kakao keyword unavailable'))
      .mockResolvedValueOnce({
        data: { addresses: [{ x: '127.0276', y: '37.4979' }] },
      });

    await expect(geocode.geocode('서울 강남구 테헤란로 123')).resolves.toEqual({
      lat: 37.4979,
      lng: 127.0276,
      provider: 'ncp',
    });
    expect(axios.get).toHaveBeenCalledTimes(3);
  });
});

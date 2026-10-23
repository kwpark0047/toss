jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const geocode = require('../../../services/geocodeService');

describe('geocodeService.searchAddresses', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    geocode._searchCache.clear();
    process.env.KAKAO_REST_API_KEY = 'kakao-key';
    delete process.env.NCP_GEOCODE_KEY_ID;
    delete process.env.NCP_GEOCODE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('도로명·지번 주소를 함께 담은 후보 목록을 반환한다', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        documents: [
          {
            address_name: '서울 중구 세종대로 110',
            address_type: 'ROAD_ADDR',
            x: '126.977829174031',
            y: '37.5663174209601',
            road_address: {
              address_name: '서울 중구 세종대로 110',
              building_name: '서울특별시청',
              zone_no: '04524',
            },
            address: { address_name: '서울 중구 태평로1가 31' },
          },
        ],
      },
    });

    const results = await geocode.searchAddresses('세종대로 110');

    expect(results).toEqual([
      {
        roadAddress: '서울 중구 세종대로 110',
        jibunAddress: '서울 중구 태평로1가 31',
        placeName: '서울특별시청',
        zipCode: '04524',
        lat: 37.566317,
        lng: 126.977829,
        source: 'kakao',
      },
    ]);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('지번 주소도 검색한다 (기존 geocode()의 도로명 제한을 적용하지 않음)', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        documents: [
          {
            address_name: '서울 중구 태평로1가 31',
            address_type: 'REGION_ADDR',
            x: '126.9778',
            y: '37.5663',
            road_address: null,
            address: { address_name: '서울 중구 태평로1가 31' },
          },
        ],
      },
    });
    const results = await geocode.searchAddresses('태평로1가 31');
    expect(results[0].jibunAddress).toBe('서울 중구 태평로1가 31');
    expect(results[0].roadAddress).toBeNull();
  });

  test('주소 결과가 없으면 키워드 검색으로 보완하고, 국외 좌표는 제외한다', async () => {
    axios.get.mockResolvedValueOnce({ data: { documents: [] } }).mockResolvedValueOnce({
      data: {
        documents: [
          {
            place_name: '위마켓 카페',
            road_address_name: '서울 강남구 테헤란로 1',
            address_name: '서울 강남구 역삼동 1',
            x: '127.03',
            y: '37.50',
          },
          { place_name: '해외', address_name: 'Tokyo', x: '139.7', y: '35.6' },
        ],
      },
    });
    const results = await geocode.searchAddresses('위마켓 카페');
    expect(results).toHaveLength(1);
    expect(results[0].placeName).toBe('위마켓 카페');
  });

  test('같은 검색어는 캐시를 사용해 프로바이더를 다시 호출하지 않는다', async () => {
    axios.get.mockResolvedValue({
      data: {
        documents: [
          { address_name: 'a', x: '127', y: '37.5', road_address: { address_name: '서울 a로 1' } },
        ],
      },
    });
    await geocode.searchAddresses('서울 a로 1');
    await geocode.searchAddresses('서울 a로 1');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('2자 미만 검색어는 호출 없이 빈 배열', async () => {
    expect(await geocode.searchAddresses(' a ')).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('프로바이더 429는 GeocodeProviderError(429)로 변환한다', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 429 } });
    await expect(geocode.searchAddresses('세종대로 110')).rejects.toMatchObject({
      name: 'GeocodeProviderError',
      status: 429,
    });
  });

  test('카카오 실패 시 NCP로 폴백한다', async () => {
    process.env.NCP_GEOCODE_KEY_ID = 'id';
    process.env.NCP_GEOCODE_KEY = 'key';
    axios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        data: {
          addresses: [
            {
              roadAddress: '서울 중구 세종대로 110',
              jibunAddress: '서울 중구 태평로1가 31',
              x: '126.9778',
              y: '37.5663',
              addressElements: [{ types: ['POSTAL_CODE'], longName: '04524' }],
            },
          ],
        },
      });
    const results = await geocode.searchAddresses('세종대로 110');
    expect(results[0]).toMatchObject({ source: 'ncp', zipCode: '04524' });
  });
});

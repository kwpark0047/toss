jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');

// 모듈 로드 전에 env 설정
process.env.NAVER_CLIENT_ID = 'test_client_id';
process.env.NAVER_CLIENT_SECRET = 'test_client_secret';

const naverPlaceService = require('../../../services/naverPlaceService');

const MOCK_SEARCH_RESPONSE = {
  data: {
    items: [
      {
        title: '<b>테스트</b>식당',
        link: 'https://place.map.naver.com/place/12345678',
        category: '한식>분식',
        telephone: '02-1234-5678',
        address: '서울시 강남구 역삼동 123',
        roadAddress: '서울시 강남구 테헤란로 123',
        mapx: 1271234567,
        mapy: 371234567,
      },
    ],
  },
};

describe('naverPlaceService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('isConfigured', () => {
    test('CLIENT_ID와 CLIENT_SECRET가 모두 설정되면 true 반환', () => {
      expect(naverPlaceService.isConfigured()).toBe(true);
    });
  });

  describe('searchPlace', () => {
    test('매장명과 주소로 네이버 플레이스 정보를 조회한다', async () => {
      axios.get.mockResolvedValue(MOCK_SEARCH_RESPONSE);

      const result = await naverPlaceService.searchPlace('테스트식당', '서울시 강남구 역삼동');

      expect(result).not.toBeNull();
      expect(result.title).toBe('테스트식당');
      expect(result.naverPlaceUrl).toBe('https://place.map.naver.com/place/12345678');
      expect(result.category).toBe('한식>분식');
      expect(result.telephone).toBe('02-1234-5678');
      expect(result.address).toBe('서울시 강남구 역삼동 123');
      expect(result.mapx).toBe(127.1234567);
      expect(result.mapy).toBe(37.1234567);

      expect(axios.get).toHaveBeenCalledTimes(1);
      const [url, config] = axios.get.mock.calls[0];
      expect(url).toContain('openapi.naver.com/v1/search/local');
      expect(config.params.query).toContain('테스트식당');
      expect(config.params.display).toBe(5);
      expect(config.headers['X-Naver-Client-Id']).toBe('test_client_id');
    });

    test('검색 결과가 없으면 null 반환', async () => {
      axios.get.mockResolvedValue({ data: { items: [], total: 0 } });

      const result = await naverPlaceService.searchPlace('존재하지않는식당', '서울시');

      expect(result).toBeNull();
    });

    test('name이 빈 문자열이면 null 반환', async () => {
      const result = await naverPlaceService.searchPlace('', '서울시');
      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('API 호출 실패 시 null 반환', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      const result = await naverPlaceService.searchPlace('테스트식당', '서울시');

      expect(result).toBeNull();
    });

    test('상호명이 정규화 비교로 매칭되지 않으면 첫 번째 결과를 fallback한다', async () => {
      axios.get.mockResolvedValue({
        data: {
          items: [
            {
              title: '<b>완전</b>다른식당',
              link: 'https://place.map.naver.com/place/99999',
              category: '일식',
              telephone: '',
              address: '서울시',
              roadAddress: '서울시',
              mapx: 0,
              mapy: 0,
            },
          ],
        },
      });

      const result = await naverPlaceService.searchPlace('테스트식당', '서울시');

      expect(result).not.toBeNull();
      expect(result.title).toBe('완전다른식당');
    });
  });
});

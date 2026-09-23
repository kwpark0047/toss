jest.mock('../../../config/prisma', () => require('../../../tests/helpers/prismaMock').create());
jest.mock('../../../services/aiService');
jest.mock('../../../services/weatherService', () => ({
  getStationByCoords: jest.fn().mockReturnValue('108'),
  getCurrentWeather: jest.fn().mockResolvedValue({ temp: 20, condition: 'Clear' }),
}));

const recommendationEngine = require('../../../services/RecommendationEngine');
const prisma = require('../../../config/prisma');
const aiService = require('../../../services/aiService');
const WeatherService = require('../../../services/weatherService');

describe('RecommendationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('_analyzeCategoryPreference', () => {
    test('카테고리별 선호도 분석', () => {
      const orders = [
        {
          order_items: [
            { product_id: 1, quantity: 2 },
            { product_id: 2, quantity: 1 },
          ],
        },
        { order_items: [{ product_id: 1, quantity: 1 }] },
      ];
      const products = [
        { id: 1, category_id: 1, category: { name: '음료' } },
        { id: 2, category_id: 2, category: { name: '디저트' } },
      ];

      const result = recommendationEngine._analyzeCategoryPreference(orders, products);

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('음료');
      expect(result[0].count).toBe(3);
      expect(result[1].category).toBe('디저트');
      expect(result[1].count).toBe(1);
    });

    test('주문이 없으면 빈 배열 반환', () => {
      const result = recommendationEngine._analyzeCategoryPreference([], []);
      expect(result).toEqual([]);
    });
  });

  describe('_getCurrentSeason', () => {
    test('현재 계절 반환', () => {
      const season = recommendationEngine._getCurrentSeason();
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(season);
    });
  });

  describe('_getTimePeriod', () => {
    test('시간대 반환', () => {
      const period = recommendationEngine._getTimePeriod();
      expect(['아침', '점심', '오후', '저녁', '야식']).toContain(period);
    });
  });

  describe('_formatPreferences', () => {
    test('선호도 문자열 포맷팅', () => {
      const categoryPreference = [
        { category: '음료', count: 10 },
        { category: '디저트', count: 5 },
      ];
      const preferences = {
        favorite_categories: ['커피', '케이크'],
        dietary_restrictions: ['견과류'],
        spiciness: 2,
      };

      const result = recommendationEngine._formatPreferences(categoryPreference, preferences);

      expect(result).toContain('음료(10회)');
      expect(result).toContain('디저트(5회)');
      expect(result).toContain('커피, 케이크');
      expect(result).toContain('견과류');
      expect(result).toContain('맵기 선호도: 2/3');
    });
  });

  describe('_getTimePeriod', () => {
    test('시간대별 기간 반환', () => {
      const period = recommendationEngine._getTimePeriod();
      expect(['아침', '점심', '오후', '저녁', '야식']).toContain(period);
    });
  });

  describe('_getWeatherContext', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      WeatherService.getStationByCoords.mockReturnValue('108');
      WeatherService.getCurrentWeather.mockResolvedValue({ temp: 20, condition: 'Clear' });
    });

    test('매장 좌표 기반 실측 날씨 반영', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });
      WeatherService.getCurrentWeather.mockResolvedValue({ temp: 15, condition: 'Rain' });

      const result = await recommendationEngine._getWeatherContext(1);

      expect(prisma.stores.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { latitude: true, longitude: true },
      });
      expect(WeatherService.getStationByCoords).toHaveBeenCalledWith(37.5665, 126.978);
      expect(WeatherService.getCurrentWeather).toHaveBeenCalledWith('108');
      expect(result).toMatchObject({ temperature: 15, condition: 'rain' });
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(result.season);
    });

    test('매장 좌표가 없으면 기본값 폴백 (외부 API 호출 없음)', async () => {
      prisma.stores.findUnique.mockResolvedValue(null);

      const result = await recommendationEngine._getWeatherContext(1);

      expect(WeatherService.getCurrentWeather).not.toHaveBeenCalled();
      expect(result).toMatchObject({ temperature: 20, condition: 'clear' });
    });

    test('날씨 서비스 실패 시 기본값 폴백', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 1, latitude: 35.1796, longitude: 129.0756 });
      WeatherService.getCurrentWeather.mockRejectedValue(new Error('KMA API down'));

      const result = await recommendationEngine._getWeatherContext(1);

      expect(result).toMatchObject({ temperature: 20, condition: 'clear' });
    });

    test('날씨 데이터에 기온 없으면 기본값 폴백', async () => {
      prisma.stores.findUnique.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });
      WeatherService.getCurrentWeather.mockResolvedValue({ temp: null, condition: 'Rain' });

      const result = await recommendationEngine._getWeatherContext(1);

      expect(result).toMatchObject({ temperature: 20, condition: 'clear' });
    });
  });

  describe('generateAndStoreRecommendations', () => {
    test('상품 데이터가 없으면 빈 배열 반환', async () => {
      prisma.products.findMany.mockResolvedValue([]);
      prisma.orders.findMany.mockResolvedValue([]);
      prisma.customer_segments.findMany.mockResolvedValue([]);
      prisma.customer_personalizations.findFirst.mockResolvedValue(null);
      prisma.order_items.findMany.mockResolvedValue([]);
      prisma.reviews.findMany.mockResolvedValue([]);
      prisma.stores.findUnique.mockResolvedValue(null);

      const result = await recommendationEngine.generateAndStoreRecommendations(1);
      expect(result).toEqual([]);
    });
  });
});

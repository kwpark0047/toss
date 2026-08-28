const recommendationEngine = require('../../../services/RecommendationEngine');

jest.mock('../../../config/prisma');
jest.mock('../../../services/aiService');

const prisma = require('../../../config/prisma');
const aiService = require('../../../services/aiService');

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

  describe('generateAndStoreRecommendations', () => {
    test('상품 데이터가 없으면 빈 배열 반환', async () => {
      prisma.products.findMany.mockResolvedValue([]);

      const result = await recommendationEngine.generateAndStoreRecommendations(1);
      expect(result).toEqual([]);
    });
  });
});

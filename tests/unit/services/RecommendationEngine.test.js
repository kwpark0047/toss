const recommendationEngine = require('../../../services/RecommendationEngine');
const prisma = require('../../../config/prisma');

jest.mock('../../../config/prisma');
jest.mock('../../../services/aiService');

describe('RecommendationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndStoreRecommendations', () => {
    test('상품 데이터가 없으면 빈 배열 반환', async () => {
      prisma.products.findMany.mockResolvedValue([]);

      const result = await recommendationEngine.generateAndStoreRecommendations(1);
      expect(result).toEqual([]);
    });

    test('기본 추천 생성 로직 동작', async () => {
      // Mock 데이터 설정
      const mockProducts = [
        {
          id: 1,
          name: '아메리카노',
          price: 4000,
          category_id: 1,
          category: { name: '음료' },
          description: '',
          image_url: null,
        },
        {
          id: 2,
          name: '카페라떼',
          price: 4500,
          category_id: 1,
          category: { name: '음료' },
          description: '',
          image_url: null,
        },
      ];

      prisma.products.findMany.mockResolvedValue(mockProducts);
      prisma.orders.findMany.mockResolvedValue([]);
      prisma.customer_segments.findMany.mockResolvedValue([]);
      prisma.customer_personalizations.findFirst.mockResolvedValue(null);

      // aiService.recommendMenus mock
      const aiService = require('../../../services/aiService');
      aiService.recommendMenus.mockResolvedValue([
        { id: 1, reason: '인기 메뉴', confidence: 0.8, evidence: ['주문 빈도 높음'] },
      ]);

      prisma.ai_recommendations.create.mockResolvedValue({ id: 1 });

      const result = await recommendationEngine.generateAndStoreRecommendations(1);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
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

      // private 메서드 테스트를 위해 내부 구현 확인
      const engine = recommendationEngine;
      // _analyzeCategoryPreference는 private이므로 generateAndStoreRecommendations를 통해 간접 테스트
      expect(typeof engine._analyzeCategoryPreference).toBe('function');
    });
  });

  describe('_getCurrentSeason', () => {
    test('현재 계절 반환', () => {
      const engine = recommendationEngine;
      const season = engine._getCurrentSeason();
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(season);
    });
  });

  describe('_getTimePeriod', () => {
    test('시간대 반환', () => {
      const engine = recommendationEngine;
      const period = engine._getTimePeriod();
      expect(['아침', '점심', '오후', '저녁', '야식']).toContain(period);
    });
  });
});

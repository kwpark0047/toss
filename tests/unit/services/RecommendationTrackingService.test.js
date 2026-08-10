jest.mock('../../../repositories/RecommendationTracking', () => ({
  recordImpression: jest.fn(),
  recordClick: jest.fn(),
  recordConversion: jest.fn(),
  upsertDailyStats: jest.fn(),
  getDailyStats: jest.fn(),
  getSummaryStats: jest.fn(),
  getSessionFunnel: jest.fn(),
}));

jest.mock('../../../config/prisma', () => ({
  recommendation_impressions: { findUnique: jest.fn(), findMany: jest.fn() },
  recommendation_clicks: { findUnique: jest.fn(), findMany: jest.fn() },
  recommendation_conversions: { findMany: jest.fn() },
  products: { findMany: jest.fn() },
}));

jest.mock('../../../repositories/Order', () => ({
  Order: { findById: jest.fn() },
}));

const Repository = require('../../../repositories/RecommendationTracking');
const prisma = require('../../../config/prisma');
const { Order } = require('../../../repositories/Order');
const service = require('../../../services/RecommendationTrackingService');

describe('RecommendationTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordImpression', () => {
    test('노출 기록 + 일일 통계 업데이트', async () => {
      Repository.recordImpression.mockResolvedValue({ id: 10 });
      Repository.upsertDailyStats.mockResolvedValue({});

      const data = { storeId: 1, recommendationType: 'weather' };
      const result = await service.recordImpression(data);

      expect(result.id).toBe(10);
      expect(Repository.upsertDailyStats).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        'weather',
        expect.objectContaining({ impressions: 1 })
      );
    });

    test('에러 시 로깅 후 재throw', async () => {
      Repository.recordImpression.mockRejectedValue(new Error('db down'));
      await expect(service.recordImpression({ storeId: 1 })).rejects.toThrow('db down');
    });
  });

  describe('recordClick', () => {
    test('impression 없으면 null', async () => {
      prisma.recommendation_impressions.findUnique.mockResolvedValue(null);
      const result = await service.recordClick({ impressionId: 'abc', storeId: 1 });
      expect(result).toBeNull();
    });

    test('impression 있으면 클릭 기록 + 통계 업데이트', async () => {
      prisma.recommendation_impressions.findUnique.mockResolvedValue({
        id: 'abc',
        created_at: new Date(),
      });
      Repository.recordClick.mockResolvedValue({ id: 20 });

      const result = await service.recordClick({
        impressionId: 'abc',
        storeId: 1,
        recommendationType: 'weather',
      });

      expect(result.id).toBe(20);
      expect(Repository.recordClick).toHaveBeenCalledWith(
        expect.objectContaining({ impressionId: 'abc', timeToClickMs: expect.any(Number) })
      );
      expect(Repository.upsertDailyStats).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        'weather',
        expect.objectContaining({ clicks: 1 })
      );
    });

    test('에러 시 재throw', async () => {
      prisma.recommendation_impressions.findUnique.mockRejectedValue(new Error('db down'));
      await expect(service.recordClick({ impressionId: 'abc', storeId: 1 })).rejects.toThrow(
        'db down'
      );
    });
  });

  describe('recordConversion', () => {
    test('주문 없으면 null', async () => {
      Order.findById.mockResolvedValue(null);
      const result = await service.recordConversion({ orderId: 99, storeId: 1 });
      expect(result).toBeNull();
    });

    test('impressionId 기준 전환 시간 계산', async () => {
      Order.findById.mockResolvedValue({ id: 99, total_amount: 30000 });
      prisma.recommendation_impressions.findUnique.mockResolvedValue({
        id: 'imp1',
        created_at: new Date(),
      });
      Repository.recordConversion.mockResolvedValue({ id: 30 });

      const result = await service.recordConversion({
        impressionId: 'imp1',
        orderId: 99,
        storeId: 1,
        recommendationType: 'menu',
      });

      expect(result.id).toBe(30);
      expect(Repository.recordConversion).toHaveBeenCalledWith(
        expect.objectContaining({
          impressionId: 'imp1',
          orderId: 99,
          conversionValue: 30000,
          timeToConversionMs: expect.any(Number),
        })
      );
      expect(Repository.upsertDailyStats).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        'menu',
        expect.objectContaining({ conversions: 1, revenue: 30000 })
      );
    });

    test('clickId 기준 전환 시간 계산', async () => {
      Order.findById.mockResolvedValue({ id: 99, total_amount: 10000 });
      prisma.recommendation_clicks.findUnique.mockResolvedValue({
        id: 'click1',
        created_at: new Date(),
      });
      Repository.recordConversion.mockResolvedValue({ id: 31 });

      const result = await service.recordConversion({
        clickId: 'click1',
        orderId: 99,
        storeId: 1,
      });

      expect(result.id).toBe(31);
      expect(Repository.recordConversion).toHaveBeenCalledWith(
        expect.objectContaining({ clickId: 'click1', conversionValue: 10000 })
      );
    });

    test('impression/click 없으면 시간 계산 없이 기록', async () => {
      Order.findById.mockResolvedValue({ id: 99, total_amount: 0 });
      Repository.recordConversion.mockResolvedValue({ id: 32 });

      const result = await service.recordConversion({ orderId: 99, storeId: 1 });
      expect(result.id).toBe(32);
      expect(Repository.recordConversion).toHaveBeenCalledWith(
        expect.objectContaining({ conversionValue: 0, timeToConversionMs: null })
      );
    });
  });

  describe('조회 메서드', () => {
    test('getDailyStats 위임', async () => {
      Repository.getDailyStats.mockResolvedValue([]);
      const result = await service.getDailyStats(1, '2026-01-01', '2026-01-31', 'weather');
      expect(result).toEqual([]);
    });

    test('getSummaryStats 위임', async () => {
      Repository.getSummaryStats.mockResolvedValue({ total_impressions: 5 });
      const result = await service.getSummaryStats(1, '2026-01-01', '2026-01-31');
      expect(result.total_impressions).toBe(5);
    });

    test('getSessionFunnel 위임', async () => {
      Repository.getSessionFunnel.mockResolvedValue({ impressions: 1 });
      const result = await service.getSessionFunnel(1, 'session1');
      expect(result.impressions).toBe(1);
    });

    test('getTypeComparison은 getSummaryStats 재사용', async () => {
      Repository.getSummaryStats.mockResolvedValue([{ type: 'weather' }]);
      const result = await service.getTypeComparison(1, '2026-01-01', '2026-01-31');
      expect(result).toEqual([{ type: 'weather' }]);
    });
  });

  describe('getMenuPerformance', () => {
    test('메뉴별 집계/정렬', async () => {
      prisma.recommendation_conversions.findMany.mockResolvedValue([
        {
          menu_id: 1,
          recommendation_type: 'weather',
          conversion_value: 1000,
          quantity: 2,
          attributed: true,
        },
        {
          menu_id: 1,
          recommendation_type: 'weather',
          conversion_value: 500,
          quantity: 1,
          attributed: true,
        },
        {
          menu_id: 2,
          recommendation_type: 'menu',
          conversion_value: 3000,
          quantity: 1,
          attributed: true,
        },
        {
          menu_id: 3,
          recommendation_type: 'weather',
          conversion_value: 999,
          quantity: 1,
          attributed: false,
        },
      ]);
      prisma.products.findMany.mockResolvedValue([
        { id: 1, name: '김치찌개', price: 8000, image_url: 'x' },
        { id: 2, name: '비빔밥', price: 9000, image_url: 'y' },
      ]);

      const result = await service.getMenuPerformance(1, '2026-01-01', '2026-01-31');

      expect(result).toHaveLength(2);
      expect(result[0].menu_id).toBe(1);
      expect(result[0].conversions).toBe(2);
      expect(result[0].revenue).toBe(1500);
      expect(result[0].quantity).toBe(3);
      expect(result[0].by_type.weather).toBe(2);
      expect(result[0].menu.name).toBe('김치찌개');
      expect(result[1].menu.name).toBe('비빔밥');
    });

    test('메뉴 없으면 Unknown 라벨', async () => {
      prisma.recommendation_conversions.findMany.mockResolvedValue([
        {
          menu_id: 42,
          recommendation_type: 'weather',
          conversion_value: 100,
          quantity: 1,
          attributed: true,
        },
      ]);
      prisma.products.findMany.mockResolvedValue([]);

      const result = await service.getMenuPerformance(1, '2026-01-01', '2026-01-31');
      expect(result[0].menu.name).toBe('Unknown');
    });
  });

  describe('getTimePeriodPerformance', () => {
    test('시간대별 집계 및 CTR/CVR', async () => {
      prisma.recommendation_impressions.findMany.mockResolvedValue([
        { id: 'i1', time_period: 'lunch', recommendation_type: 'weather', created_at: new Date() },
        { id: 'i2', time_period: 'lunch', recommendation_type: 'weather', created_at: new Date() },
        { id: 'i3', time_period: 'dinner', recommendation_type: 'weather', created_at: new Date() },
      ]);
      prisma.recommendation_clicks.findMany.mockResolvedValue([{ impression_id: 'i1' }]);
      prisma.recommendation_conversions.findMany.mockResolvedValue([
        { impression_id: 'i1', conversion_value: 2000 },
      ]);

      const result = await service.getTimePeriodPerformance(1, '2026-01-01', '2026-01-31');

      expect(result).toHaveLength(2);
      const lunch = result.find((r) => r.time_period === 'lunch');
      expect(lunch.impressions).toBe(2);
      expect(lunch.clicks).toBe(1);
      expect(lunch.conversions).toBe(1);
      expect(lunch.revenue).toBe(2000);
      expect(lunch.ctr).toBe(0.5);
      expect(lunch.cvr).toBe(1);

      const dinner = result.find((r) => r.time_period === 'dinner');
      expect(dinner.ctr).toBe(0);
      expect(dinner.cvr).toBe(0);
    });

    test('time_period 미지정이면 unknown', async () => {
      prisma.recommendation_impressions.findMany.mockResolvedValue([
        { id: 'i1', time_period: null, created_at: new Date() },
      ]);
      prisma.recommendation_clicks.findMany.mockResolvedValue([]);
      prisma.recommendation_conversions.findMany.mockResolvedValue([]);

      const result = await service.getTimePeriodPerformance(1, '2026-01-01', '2026-01-31');
      expect(result[0].time_period).toBe('unknown');
    });
  });
});

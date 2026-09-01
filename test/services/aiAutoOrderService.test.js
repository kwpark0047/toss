const AiAutoOrderService = require('../../services/AiAutoOrderService');
const prisma = require('../../config/prisma');
const demandForecastService = require('../../services/DemandForecastService');

jest.mock('../../config/prisma', () => {
  const mockAutoOrderRecommendation = {
    id: 100,
    store_id: 1,
    product_id: 1,
    candidate_id: 10,
    current_stock: 5,
    forecast_demand: 60,
    forecast_confidence: 0.77,
    recommended_qty: 62,
    statistical_qty: 50,
    demand_based_qty: 65,
    shortage_level: 'critical',
    reason: 'test reason',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  };

  return {
    products: {
      findMany: jest.fn(),
    },
    orders: {
      findMany: jest.fn(),
    },
    demand_forecasts: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    inventory_reorder_candidates: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    inventory_auto_order_recommendations: {
      upsert: jest.fn().mockResolvedValue(mockAutoOrderRecommendation),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    order_items: {
      findMany: jest.fn(),
    },
  };
});

jest.mock('../../services/DemandForecastService', () => ({
  generateForecastsForStore: jest.fn(),
  getForecasts: jest.fn(),
}));

jest.mock('../../services/InventoryReorderService', () => ({
  generateCandidates: jest.fn(),
  list: jest.fn(),
  decide: jest.fn(),
}));

const InventoryReorderService = require('../../services/InventoryReorderService');

describe('AiAutoOrderService', () => {
  const storeId = 1;
  const mockProducts = [
    { id: 1, name: '아메리카노', stock_quantity: 1, low_stock_threshold: 10 },
    { id: 2, name: '카페라떼', stock_quantity: 20, low_stock_threshold: 15 },
  ];
  const mockOrders = [
    {
      order_items: [
        { product_id: 1, quantity: 50 },
        { product_id: 2, quantity: 10 },
      ],
    },
    { order_items: [{ product_id: 1, quantity: 40 }] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShortages', () => {
    it('재고가 부족한 상품만 반환해야 한다', async () => {
      prisma.products.findMany.mockResolvedValue(mockProducts);
      prisma.orders.findMany.mockResolvedValue(mockOrders);

      const result = await AiAutoOrderService.getShortages(storeId, { lookbackDays: 30 });

      expect(result.shortages).toHaveLength(1);
      expect(result.shortages[0].productId).toBe(1);
      expect(result.shortages[0].productName).toBe('아메리카노');
      expect(result.shortages[0].currentStock).toBe(1);
      expect(result.shortages[0].shortageLevel).toBe('critical');
      expect(result.parameters.lookbackDays).toBe(30);
    });

    it('재고가 충분한 상품은 제외해야 한다', async () => {
      const sufficientProducts = [
        { id: 2, name: '카페라떼', stock_quantity: 50, low_stock_threshold: 15 },
      ];
      prisma.products.findMany.mockResolvedValue(sufficientProducts);
      prisma.orders.findMany.mockResolvedValue(mockOrders);

      const result = await AiAutoOrderService.getShortages(storeId);

      expect(result.shortages).toHaveLength(0);
      expect(result.shortageCount).toBe(0);
    });

    it('유효하지 않은 매장 ID는 에러를 던져야 한다', async () => {
      await expect(AiAutoOrderService.getShortages(0)).rejects.toThrow(
        '유효하지 않은 매장 ID입니다.'
      );
      await expect(AiAutoOrderService.getShortages('abc')).rejects.toThrow(
        '유효하지 않은 매장 ID입니다.'
      );
    });

    it('파라미터 클램핑이 작동해야 한다', async () => {
      prisma.products.findMany.mockResolvedValue(mockProducts);
      prisma.orders.findMany.mockResolvedValue(mockOrders);

      await AiAutoOrderService.getShortages(storeId, {
        lookbackDays: 200, // 90으로 클램핑
        leadTimeDays: -5, // 0으로 클램핑
        safetyDays: 50, // 30으로 클램핑
      });

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: { gte: expect.any(Date) },
          }),
        })
      );
    });
  });

  describe('generateRecommendation', () => {
    const mockReorderCandidates = [
      {
        id: 10,
        product_id: 1,
        suggested_quantity: 50,
        average_daily_sales: 2.5,
        reorder_point: 12,
        product: { id: 1, name: '아메리카노', stock_quantity: 5 },
      },
      {
        id: 11,
        product_id: 2,
        suggested_quantity: 30,
        average_daily_sales: 1.5,
        reorder_point: 8,
        product: { id: 2, name: '카페라떼', stock_quantity: 15 },
      },
    ];

    const mockForecasts = [
      { product_id: 1, predicted_demand: 20, confidence_score: 0.8 },
      { product_id: 1, predicted_demand: 18, confidence_score: 0.8 },
      { product_id: 1, predicted_demand: 22, confidence_score: 0.7 },
      { product_id: 2, predicted_demand: 10, confidence_score: 0.6 },
      { product_id: 2, predicted_demand: 12, confidence_score: 0.6 },
    ];

    it('AI 추천이 발주 후보와 수요 예측을 결합해야 한다', async () => {
      InventoryReorderService.generateCandidates.mockResolvedValue({
        candidates: mockReorderCandidates,
        parameters: { lookbackDays: 30, leadTimeDays: 3, safetyDays: 2 },
      });
      demandForecastService.generateForecastsForStore.mockResolvedValue([]);
      prisma.demand_forecasts.findMany.mockResolvedValue(mockForecasts);

      const result = await AiAutoOrderService.generateRecommendation(storeId, {
        horizonDays: 7,
        useAI: true,
      });

      expect(result.recommendations).toHaveLength(2);
      expect(InventoryReorderService.generateCandidates).toHaveBeenCalledWith(storeId, {
        lookbackDays: 30,
        leadTimeDays: 3,
        safetyDays: 2,
      });
      expect(demandForecastService.generateForecastsForStore).toHaveBeenCalledWith(storeId, {
        productIds: [1, 2],
        horizonDays: 7,
        useAI: true,
      });
    });

    it('수요 예측이 있을 때 하이브리드 가중 평균을 계산해야 한다', async () => {
      InventoryReorderService.generateCandidates.mockResolvedValue({
        candidates: mockReorderCandidates,
        parameters: { lookbackDays: 30, leadTimeDays: 3, safetyDays: 2 },
      });
      demandForecastService.generateForecastsForStore.mockResolvedValue([]);
      prisma.demand_forecasts.findMany.mockResolvedValue(mockForecasts);

      const result = await AiAutoOrderService.generateRecommendation(storeId);

      // 아메리카노: 통계 50개, 예측 기반 (20+18+22=60) + 안전재고 5 = 65, 신뢰도 0.8
      // 가중: 50*0.2 + 65*0.8 = 10 + 52 = 62
      const americanoRec = result.recommendations.find((r) => r.productId === 1);
      expect(americanoRec.forecastDemand).toBe(60);
      expect(americanoRec.forecastConfidence).toBe(0.77);
      expect(americanoRec.recommendedOrderQty).toBeGreaterThan(0);
      expect(americanoRec.reason).toContain('통계적 산출');
      expect(americanoRec.reason).toContain('AI 예측');
      expect(americanoRec.reason).toContain('최종 추천');
    });

    it('수요 예측이 없으면 통계적 산출값만 사용해야 한다', async () => {
      InventoryReorderService.generateCandidates.mockResolvedValue({
        candidates: mockReorderCandidates,
        parameters: { lookbackDays: 30, leadTimeDays: 3, safetyDays: 2 },
      });
      demandForecastService.generateForecastsForStore.mockResolvedValue([]);
      prisma.demand_forecasts.findMany.mockResolvedValue([]);

      const result = await AiAutoOrderService.generateRecommendation(storeId);

      const americanoRec = result.recommendations.find((r) => r.productId === 1);
      expect(americanoRec.forecastDemand).toBe(0);
      expect(americanoRec.recommendedOrderQty).toBe(50); // 통계적 값 그대로
      expect(americanoRec.reason).toContain('AI 예측 데이터 없음');
    });

    it('발주 후보가 없으면 빈 배열을 반환해야 한다', async () => {
      InventoryReorderService.generateCandidates.mockResolvedValue({
        candidates: [],
        parameters: { lookbackDays: 30, leadTimeDays: 3, safetyDays: 2 },
      });

      const result = await AiAutoOrderService.generateRecommendation(storeId);

      expect(result.recommendations).toHaveLength(0);
      expect(result.message).toBe('자동 발주 대상이 없습니다.');
    });

    it('긴급도순으로 정렬되어야 한다 (critical > high > medium)', async () => {
      const candidatesWithLevels = [
        {
          ...mockReorderCandidates[0],
          product: { ...mockReorderCandidates[0].product, stock_quantity: 2 },
        }, // critical
        {
          ...mockReorderCandidates[1],
          product: { ...mockReorderCandidates[1].product, stock_quantity: 10 },
        }, // high
        {
          ...mockReorderCandidates[0],
          id: 12,
          product_id: 3,
          product: { id: 3, name: '에스프레소', stock_quantity: 10 },
          reorder_point: 15,
        }, // medium
      ];
      InventoryReorderService.generateCandidates.mockResolvedValue({
        candidates: candidatesWithLevels,
        parameters: { lookbackDays: 30, leadTimeDays: 3, safetyDays: 2 },
      });
      demandForecastService.generateForecastsForStore.mockResolvedValue([]);
      prisma.demand_forecasts.findMany.mockResolvedValue([]);

      const result = await AiAutoOrderService.generateRecommendation(storeId);

      expect(result.recommendations[0].shortageLevel).toBe('critical');
      expect(result.recommendations[1].shortageLevel).toBe('high');
      expect(result.recommendations[2].shortageLevel).toBe('medium');
    });

    it('유효하지 않은 매장 ID는 에러를 던져야 한다', async () => {
      await expect(AiAutoOrderService.generateRecommendation(0)).rejects.toThrow(
        '유효하지 않은 매장 ID입니다.'
      );
    });
  });

  describe('decide', () => {
    const mockRecommendation = {
      id: 10,
      store_id: 1,
      product_id: 1,
      status: 'pending',
    };

    it('승인 상태로 업데이트해야 한다', async () => {
      prisma.inventory_auto_order_recommendations.findFirst.mockResolvedValue(mockRecommendation);
      prisma.inventory_auto_order_recommendations.update.mockResolvedValue({
        ...mockRecommendation,
        status: 'approved',
        approved_by: 5,
        approved_at: new Date(),
      });

      const result = await AiAutoOrderService.decide(10, 1, 'approved', 5);

      expect(result.status).toBe('approved');
      expect(result.approved_by).toBe(5);
      expect(prisma.inventory_auto_order_recommendations.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'approved', approved_by: 5, approved_at: expect.any(Date) },
      });
    });

    it('거절 상태로 업데이트해야 한다', async () => {
      prisma.inventory_auto_order_recommendations.findFirst.mockResolvedValue(mockRecommendation);
      prisma.inventory_auto_order_recommendations.update.mockResolvedValue({
        ...mockRecommendation,
        status: 'rejected',
        approved_by: 5,
        approved_at: new Date(),
      });

      const result = await AiAutoOrderService.decide(10, 1, 'rejected', 5);

      expect(result.status).toBe('rejected');
    });

    it('존재하지 않는 후보는 404 에러를 던져야 한다', async () => {
      prisma.inventory_auto_order_recommendations.findFirst.mockResolvedValue(null);

      await expect(AiAutoOrderService.decide(999, 1, 'approved', 5)).rejects.toThrow(
        '발주 추천을 찾을 수 없습니다.'
      );
    });

    it('이미 처리된 후보는 409 에러를 던져야 한다', async () => {
      prisma.inventory_auto_order_recommendations.findFirst.mockResolvedValue({
        ...mockRecommendation,
        status: 'approved',
      });

      await expect(AiAutoOrderService.decide(10, 1, 'approved', 5)).rejects.toThrow(
        '이미 처리된 발주 추천입니다.'
      );
    });

    it('유효하지 않은 상태는 에러를 던져야 한다', async () => {
      await expect(AiAutoOrderService.decide(10, 1, 'invalid', 5)).rejects.toThrow(
        '유효하지 않은 결정입니다.'
      );
    });

    it('유효하지 않은 후보 ID는 에러를 던져야 한다', async () => {
      await expect(AiAutoOrderService.decide(-1, 1, 'approved', 5)).rejects.toThrow(
        '유효하지 않은 추천 ID입니다.'
      );
    });
  });
});

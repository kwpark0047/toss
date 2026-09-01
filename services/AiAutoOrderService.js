const prisma = require('../config/prisma');
const InventoryReorderService = require('./InventoryReorderService');
const demandForecastService = require('./DemandForecastService');
const { AppError } = require('../utils/errorHandler');

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new AppError(`유효하지 않은 ${fieldName}입니다.`, 400);
  return parsed;
};

const AiAutoOrderService = {
  /**
   * 재고 부족 상품 조회 (기존 InventoryReorderService.generateCandidates 기반)
   * 통계적 판매량 분석으로 발주 후보 산출
   */
  async getShortages(storeId, options = {}) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const lookbackDays = Math.min(90, Math.max(7, Number.parseInt(options.lookbackDays, 10) || 30));
    const leadTimeDays = Math.min(30, Math.max(0, Number.parseInt(options.leadTimeDays, 10) || 3));
    const safetyDays = Math.min(30, Math.max(0, Number.parseInt(options.safetyDays, 10) || 2));
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const [products, orders] = await Promise.all([
      prisma.products.findMany({
        where: { store_id: storeNumber, stock_quantity: { not: null }, is_active: true },
        select: { id: true, name: true, stock_quantity: true, low_stock_threshold: true },
      }),
      prisma.orders.findMany({
        where: { store_id: storeNumber, created_at: { gte: since }, status: { not: 'cancelled' } },
        select: { order_items: { select: { product_id: true, quantity: true } } },
      }),
    ]);

    const soldByProduct = new Map();
    for (const order of orders) {
      for (const item of order.order_items || []) {
        soldByProduct.set(
          item.product_id,
          (soldByProduct.get(item.product_id) || 0) + (item.quantity || 0)
        );
      }
    }

    const shortages = [];
    for (const product of products) {
      const averageDailySales = (soldByProduct.get(product.id) || 0) / lookbackDays;
      const reorderPoint = Math.ceil(averageDailySales * (leadTimeDays + safetyDays));

      if (product.stock_quantity <= reorderPoint) {
        const shortageLevel =
          product.stock_quantity <= reorderPoint * 0.3
            ? 'critical'
            : product.stock_quantity <= reorderPoint * 0.7
              ? 'high'
              : 'medium';

        shortages.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.stock_quantity,
          lowStockThreshold: product.low_stock_threshold,
          averageDailySales: Math.round(averageDailySales * 100) / 100,
          reorderPoint,
          shortageLevel,
          reason: `최근 ${lookbackDays}일 일평균 판매량 ${averageDailySales.toFixed(1)}개, 재주문점 ${reorderPoint}개 이하`,
        });
      }
    }

    return {
      shortages,
      parameters: { lookbackDays, leadTimeDays, safetyDays },
      totalProducts: products.length,
      shortageCount: shortages.length,
    };
  },

  /**
   * AI 자동 발주 추천 생성 (하이브리드: 통계 + AI 조정)
   * 1. InventoryReorderService 로직으로 기본 발주 후보 산출
   * 2. DemandForecastService로 수요 예측 조회/생성
   * 3. 두 결과를 결합하여 추천 수량 조정
   * 4. 결과를 inventory_auto_order_recommendations에 저장
   */
  async generateRecommendation(storeId, options = {}) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const {
      lookbackDays = 30,
      leadTimeDays = 3,
      safetyDays = 2,
      horizonDays = 7,
      useAI = true,
      productIds = null,
    } = options;

    // 1. 기본 발주 후보 산출 (통계적)
    const reorderOptions = { lookbackDays, leadTimeDays, safetyDays };
    const { candidates: reorderCandidates, parameters } =
      await InventoryReorderService.generateCandidates(storeNumber, reorderOptions);

    if (!reorderCandidates.length) {
      return {
        recommendations: [],
        message: '자동 발주 대상이 없습니다.',
        parameters: { lookbackDays, leadTimeDays, safetyDays, horizonDays, useAI },
      };
    }

    // 2. 수요 예측 생성/조회 (AI 조정 포함)
    const targetProductIds = productIds || reorderCandidates.map((c) => c.product_id);
    await demandForecastService.generateForecastsForStore(storeNumber, {
      productIds: targetProductIds,
      horizonDays,
      useAI,
    });

    // 3. 향후 horizonDays 수요 예측 합계 조회
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + horizonDays);
    const forecasts = await prisma.demand_forecasts.findMany({
      where: {
        store_id: storeNumber,
        product_id: { in: targetProductIds },
        forecast_date: { gte: new Date(), lte: endDate },
      },
    });

    const forecastMap = new Map();
    for (const f of forecasts) {
      const existing = forecastMap.get(f.product_id) || {
        totalDemand: 0,
        avgConfidence: 0,
        count: 0,
      };
      existing.totalDemand += f.predicted_demand;
      existing.avgConfidence =
        (existing.avgConfidence * existing.count + f.confidence_score) / (existing.count + 1);
      existing.count++;
      forecastMap.set(f.product_id, existing);
    }

    // 4. 하이브리드 추천 수량 계산 및 저장
    const recommendations = [];
    for (const candidate of reorderCandidates) {
      const product = candidate.product;
      const forecastData = forecastMap.get(product.id);
      const forecastDemand = forecastData ? Math.round(forecastData.totalDemand) : 0;
      const forecastConfidence = forecastData
        ? Math.round(forecastData.avgConfidence * 100) / 100
        : 0.5;

      // 기본 통계적 추천 수량
      const statisticalQty = candidate.suggested_quantity;

      // AI 수요 예측이 있는 경우 하이브리드 조정
      let recommendedOrderQty = statisticalQty;
      let demandBasedQty = 0;
      let reason = `통계적 산출: 일평균 ${candidate.average_daily_sales.toFixed(1)}개 × (리드타임 ${leadTimeDays}일 + 안전재고 ${safetyDays}일)`;

      if (forecastDemand > 0) {
        // 향후 수요 예측 기반 필요 재고 = 예측 수요 + 안전재고
        const safetyStock = Math.ceil(candidate.average_daily_sales * safetyDays);
        demandBasedQty = Math.max(0, forecastDemand + safetyStock - product.stock_quantity);

        // 두 방식의 가중 평균 (AI 신뢰도에 따라 가중치 조정)
        const aiWeight = forecastConfidence;
        const statWeight = 1 - aiWeight;
        recommendedOrderQty = Math.round(statisticalQty * statWeight + demandBasedQty * aiWeight);

        reason += ` | AI 예측: 향후 ${horizonDays}일 수요 ${forecastDemand}개 (신뢰도 ${forecastConfidence}) → 예측 기반 필요량 ${demandBasedQty}개`;
        reason += ` | 최종 추천: 통계(${statisticalQty}개) × ${statWeight.toFixed(1)} + 예측(${demandBasedQty}개) × ${aiWeight.toFixed(1)} = ${recommendedOrderQty}개`;
      } else {
        reason += ` | AI 예측 데이터 없음, 통계적 산출값 사용`;
      }

      // 부족 레벨 결정
      const shortageRatio = product.stock_quantity / candidate.reorder_point;
      let shortageLevel = 'medium';
      if (shortageRatio <= 0.3) shortageLevel = 'critical';
      else if (shortageRatio <= 0.7) shortageLevel = 'high';
      else if (shortageRatio <= 1.0) shortageLevel = 'medium';

      // 5. 추천 결과 저장 (upsert로 중복 방지)
      const saved = await prisma.inventory_auto_order_recommendations.upsert({
        where: {
          store_id_product_id_status: {
            store_id: storeNumber,
            product_id: product.id,
            status: 'pending',
          },
        },
        create: {
          store_id: storeNumber,
          product_id: product.id,
          candidate_id: candidate.id,
          current_stock: product.stock_quantity,
          forecast_demand: forecastDemand,
          forecast_confidence: forecastConfidence,
          recommended_qty: Math.max(0, recommendedOrderQty),
          statistical_qty: statisticalQty,
          demand_based_qty: demandBasedQty,
          shortage_level: shortageLevel,
          reason,
          status: 'pending',
        },
        update: {
          current_stock: product.stock_quantity,
          forecast_demand: forecastDemand,
          forecast_confidence: forecastConfidence,
          recommended_qty: Math.max(0, recommendedOrderQty),
          statistical_qty: statisticalQty,
          demand_based_qty: demandBasedQty,
          shortage_level: shortageLevel,
          reason,
          candidate_id: candidate.id,
        },
      });

      recommendations.push({
        recommendationId: saved.id,
        candidateId: candidate.id,
        productId: product.id,
        productName: product.name,
        currentStock: product.stock_quantity,
        forecastDemand,
        forecastConfidence,
        recommendedOrderQty: Math.max(0, recommendedOrderQty),
        reorderPoint: candidate.reorder_point,
        shortageLevel,
        reason,
        parameters: { lookbackDays, leadTimeDays, safetyDays, horizonDays, useAI },
      });
    }

    // 긴급도순 정렬 (critical → high → medium)
    const levelOrder = { critical: 0, high: 1, medium: 2 };
    recommendations.sort((a, b) => levelOrder[a.shortageLevel] - levelOrder[b.shortageLevel]);

    return {
      recommendations,
      totalCandidates: reorderCandidates.length,
      parameters: { lookbackDays, leadTimeDays, safetyDays, horizonDays, useAI },
    };
  },

  /**
   * 발주 추천 목록 조회 (신규 모델 기반)
   */
  async listRecommendations(storeId, status = 'pending') {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    if (!['pending', 'approved', 'rejected', 'ordered'].includes(status))
      throw new AppError('유효하지 않은 추천 상태입니다.', 400);
    return prisma.inventory_auto_order_recommendations.findMany({
      where: { store_id: storeNumber, status },
      orderBy: { created_at: 'desc' },
      include: {
        products: { select: { id: true, name: true, price: true } },
      },
    });
  },

  /**
   * 발주 추천 단건 조회
   */
  async getRecommendation(recommendationId, storeId) {
    const id = parsePositiveInt(recommendationId, '추천 ID');
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const rec = await prisma.inventory_auto_order_recommendations.findFirst({
      where: { id, store_id: storeNumber },
      include: { products: { select: { id: true, name: true, price: true } } },
    });
    if (!rec) throw new AppError('발주 추천을 찾을 수 없습니다.', 404);
    return rec;
  },

  /**
   * 발주 추천 승인/거절/발주완료 결정
   */
  async decide(recommendationId, storeId, status, userId) {
    const id = parsePositiveInt(recommendationId, '추천 ID');
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    if (!['approved', 'rejected', 'ordered'].includes(status))
      throw new AppError('유효하지 않은 결정입니다.', 400);

    const rec = await prisma.inventory_auto_order_recommendations.findFirst({
      where: { id, store_id: storeNumber },
    });
    if (!rec) throw new AppError('발주 추천을 찾을 수 없습니다.', 404);
    if (rec.status !== 'pending') throw new AppError('이미 처리된 발주 추천입니다.', 409);

    const updateData = { status, approved_by: userId, approved_at: new Date() };
    if (status === 'ordered') {
      updateData.ordered_at = new Date();
    }

    return prisma.inventory_auto_order_recommendations.update({
      where: { id },
      data: updateData,
    });
  },

  /**
   * 발주 추천 상세 통계
   */
  async getStats(storeId) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const [pending, approved, rejected, ordered, totalQty] = await Promise.all([
      prisma.inventory_auto_order_recommendations.count({
        where: { store_id: storeNumber, status: 'pending' },
      }),
      prisma.inventory_auto_order_recommendations.count({
        where: { store_id: storeNumber, status: 'approved' },
      }),
      prisma.inventory_auto_order_recommendations.count({
        where: { store_id: storeNumber, status: 'rejected' },
      }),
      prisma.inventory_auto_order_recommendations.count({
        where: { store_id: storeNumber, status: 'ordered' },
      }),
      prisma.inventory_auto_order_recommendations.aggregate({
        where: { store_id: storeNumber, status: { in: ['approved', 'ordered'] } },
        _sum: { recommended_qty: true },
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
      ordered,
      totalApprovedQty: totalQty._sum.recommended_qty || 0,
    };
  },
};

module.exports = AiAutoOrderService;

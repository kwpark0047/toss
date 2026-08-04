const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const dashboardBroadcastService = require('../services/DashboardBroadcastService');

function calculateWeightedDemand(recentOrders, days) {
  if (recentOrders.length === 0)
    return { predicted: 0, confidence: 0.3, trend: 'insufficient_data' };

  const ordersByDay = {};
  for (const o of recentOrders) {
    const d = new Date(o.created_at).toISOString().slice(0, 10);
    ordersByDay[d] = (ordersByDay[d] || 0) + o._count?.order_items || 1;
  }

  const dailyTotals = Object.values(ordersByDay);
  const n = dailyTotals.length;
  if (n === 0) return { predicted: 0, confidence: 0.3, trend: 'insufficient_data' };

  const weights = dailyTotals.map((_, i) => (i + 1) / ((n * (n + 1)) / 2));
  const weightedAvg = dailyTotals.reduce((sum, v, i) => sum + v * weights[i], 0);

  const firstHalf =
    dailyTotals.slice(0, Math.floor(n / 2)).reduce((a, b) => a + b, 0) / Math.floor(n / 2) || 1;
  const secondHalf =
    dailyTotals.slice(Math.floor(n / 2)).reduce((a, b) => a + b, 0) / (n - Math.floor(n / 2)) || 1;
  const trend =
    secondHalf > firstHalf * 1.1
      ? 'increasing'
      : secondHalf < firstHalf * 0.9
        ? 'decreasing'
        : 'stable';
  const trendFactor = trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1.0;

  const mean = dailyTotals.reduce((a, b) => a + b, 0) / n;
  const variance = dailyTotals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const confidence = Math.min(0.95, Math.max(0.3, 0.5 + (n / 60) * 0.3 - cv * 0.1));

  const predicted = Math.max(0, Math.round(weightedAvg * trendFactor));
  return { predicted, confidence, trend };
}

const DemandForecastController = {
  getDemandForecasts: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productId } = req.query;
      const forecasts = await prisma.demand_forecasts.findMany({
        where: {
          store_id: Number(storeId),
          ...(productId && { product_id: Number(productId) }),
          forecast_date: { gte: new Date() },
        },
        orderBy: { forecast_date: 'asc' },
        take: 50,
        include: { products: { select: { id: true, name: true, price: true } } },
      });
      res.success(forecasts, '수요 예측 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  generateDemandForecasts: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productIds } = req.body;

      const products = await prisma.products.findMany({
        where: {
          store_id: Number(storeId),
          ...(productIds && { id: { in: productIds.map(Number) } }),
        },
      });

      if (products.length === 0) {
        throw new AppError('예측할 상품을 찾을 수 없습니다.', 404);
      }

      const results = [];
      const now = new Date();
      const forecastDate = new Date(now.getTime() + 7 * 86400000);

      for (const product of products) {
        try {
          const recentOrders = await prisma.orders.findMany({
            where: {
              store_id: Number(storeId),
              created_at: { gte: new Date(now.getTime() - 30 * 86400000) },
              status: { not: 'cancelled' },
            },
            include: {
              order_items: { where: { product_id: product.id }, select: { id: true } },
            },
          });

          const dailyOrders = recentOrders.filter((o) => o.order_items.length > 0);
          const {
            predicted: baselinePredicted,
            confidence: baselineConfidence,
            trend,
          } = calculateWeightedDemand(dailyOrders, 30);

          let predictedDemand = baselinePredicted;
          let confidence = baselineConfidence;
          let aiInsight = '';

          try {
            const prompt = `다음은 최근 30일간의 특정 메뉴(${product.name}) 일일 주문 건수 패턴입니다: ${dailyOrders.length}건 발생. 트렌드: ${trend}.
이 데이터를 바탕으로 다음 주 예상 수요량, 신뢰도(0~1), 그리고 매장 운영을 위한 짧은 코멘트(1~2문장)를 JSON으로 제안해주세요. 
기본 예측치: ${baselinePredicted}, 신뢰도: ${baselineConfidence}.
형식: {"predicted": 숫자, "confidence": 숫자, "comment": "코멘트"}`;
            const aiResText = await aiService.generateWithFallback(prompt, {
              generationConfig: { temperature: 0.3, response_mime_type: 'application/json' },
            });
            const aiRes = JSON.parse(aiResText);
            predictedDemand = aiRes.predicted ?? baselinePredicted;
            confidence = aiRes.confidence ?? baselineConfidence;
            aiInsight = aiRes.comment ?? '';
          } catch (e) {
            // AI 수요 예측 실패 시 통계 기반(baseline) 값으로 대체 — 서비스 가용성 유지
            logger.warn(
              { storeId, productId: product?.id, error: e.message },
              'AI 수요 예측 생성 중 오류 (베이스라인 사용)'
            );
          }

          const weekLater = new Date(now.getTime() + 7 * 86400000);
          const forecast = await prisma.demand_forecasts.upsert({
            where: {
              store_product_date: {
                store_id: Number(storeId),
                product_id: product.id,
                forecast_date: weekLater,
              },
            },
            create: {
              store_id: Number(storeId),
              product_id: product.id,
              forecast_date: weekLater,
              predicted_demand: predictedDemand,
              confidence_score: confidence,
              factors: {
                dayOfWeek: weekLater.getDay(),
                trend,
                dataPoints: dailyOrders.length,
                holiday: false,
                aiInsight,
              },
              model_version: 'v2.0-weighted',
            },
            update: {
              predicted_demand: predictedDemand,
              confidence_score: confidence,
              factors: {
                dayOfWeek: weekLater.getDay(),
                trend,
                dataPoints: dailyOrders.length,
                holiday: false,
                aiInsight,
              },
              model_version: 'v2.0-gemini',
              updated_at: new Date(),
            },
          });
          results.push(forecast);
        } catch (_) {
          /* continue with next product */
        }
      }

      res.success(
        {
          forecasts_generated: results.length,
          forecast_date: forecastDate.toISOString(),
          forecasts: results,
        },
        '수요 예측 생성 완료'
      );

      // 실시간 대시보드에 수요 예측 결과 브로드캐스트 (store_${storeId}_dashboard 룸)
      dashboardBroadcastService.notifyForecastUpdate(Number(storeId), {
        store_id: Number(storeId),
        forecast_date: forecastDate.toISOString(),
        forecasts_generated: results.length,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  getForecastById: async (req, res, next) => {
    try {
      const { storeId, forecastId } = req.params;
      const forecast = await prisma.demand_forecasts.findFirst({
        where: { id: Number(forecastId), store_id: Number(storeId) },
        include: { products: { select: { id: true, name: true, price: true } } },
      });
      if (!forecast) throw new AppError('예측을 찾을 수 없습니다.', 404);
      res.success(forecast, '수요 예측 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  getCompetitorPrices: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productName, active = true } = req.query;
      const where = { store_id: Number(storeId), is_active: active === 'true' };
      if (productName) where.product_name = { contains: productName, mode: 'insensitive' };

      const prices = await prisma.competitor_prices.findMany({
        where,
        orderBy: { last_checked: 'desc' },
        take: 100,
      });
      res.success(prices, '경쟁사 가격 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  addCompetitorPrice: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { product_name, competitor_name, competitor_price, competitor_url } = req.body;
      if (!product_name || !competitor_name || !competitor_price) {
        throw new AppError('product_name, competitor_name, competitor_price는 필수입니다.', 400);
      }
      const price = await prisma.competitor_prices.create({
        data: {
          store_id: Number(storeId),
          product_name,
          competitor_name,
          competitor_price: Number(competitor_price),
          competitor_url: competitor_url || null,
        },
      });
      res.success(price, '경쟁사 가격 추가 완료', 201);
    } catch (err) {
      next(err);
    }
  },

  updateCompetitorPrice: async (req, res, next) => {
    try {
      const { storeId, priceId } = req.params;
      const { competitor_price, competitor_url, is_active } = req.body;
      const price = await prisma.competitor_prices.update({
        where: { id: Number(priceId), store_id: Number(storeId) },
        data: {
          ...(competitor_price !== undefined && { competitor_price: Number(competitor_price) }),
          ...(competitor_url !== undefined && { competitor_url }),
          ...(is_active !== undefined && { is_active }),
        },
      });
      res.success(price, '경쟁사 가격 수정 완료');
    } catch (err) {
      next(err);
    }
  },

  deleteCompetitorPrice: async (req, res, next) => {
    try {
      const { storeId, priceId } = req.params;
      await prisma.competitor_prices.delete({
        where: { id: Number(priceId), store_id: Number(storeId) },
      });
      res.success(null, '경쟁사 가격 삭제 완료');
    } catch (err) {
      next(err);
    }
  },

  getPricingJobs: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const jobs = await prisma.pricing_optimization_jobs.findMany({
        where: { store_id: Number(storeId) },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
      res.success(jobs, '가격 최적화 작업 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  startPricingOptimizationJob: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { job_type } = req.body;
      if (!job_type) throw new AppError('job_type은 필수입니다.', 400);

      const job = await prisma.pricing_optimization_jobs.create({
        data: {
          store_id: Number(storeId),
          status: 'PENDING',
          job_type: job_type,
        },
      });

      res.success(job, '가격 최적화 작업 시작됨', 201);
    } catch (err) {
      next(err);
    }
  },

  getPricingJobStatus: async (req, res, next) => {
    try {
      const { storeId, jobId } = req.params;
      const job = await prisma.pricing_optimization_jobs.findFirst({
        where: { id: Number(jobId), store_id: Number(storeId) },
      });
      if (!job) throw new AppError('작업을 찾을 수 없습니다.', 404);
      res.success(job, '작업 상태 조회 완료');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DemandForecastController;

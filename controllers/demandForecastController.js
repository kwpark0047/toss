const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

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
            predicted: predictedDemand,
            confidence,
            trend,
          } = calculateWeightedDemand(dailyOrders, 30);

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
              },
              model_version: 'v2.0-weighted',
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

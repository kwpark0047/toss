const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const dashboardBroadcastService = require('../services/DashboardBroadcastService');
const demandForecastService = require('../services/DemandForecastService');

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
      const { productIds, horizonDays = 7, useAI = true } = req.body;

      const forecasts = await demandForecastService.generateForecastsForStore(Number(storeId), {
        productIds,
        horizonDays,
        useAI,
      });

      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + 1);
      forecastDate.setHours(0, 0, 0, 0);

      res.success(
        {
          forecasts_generated: forecasts.length,
          forecast_date: forecastDate.toISOString(),
          forecasts: forecasts,
        },
        '수요 예측 생성 완료'
      );

      // 실시간 대시보드에 수요 예측 결과 브로드캐스트
      dashboardBroadcastService.notifyForecastUpdate(Number(storeId), {
        store_id: Number(storeId),
        forecast_date: forecastDate.toISOString(),
        forecasts_generated: forecasts.length,
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

  // 수요 예측 정확도 평가
  evaluateForecastAccuracy: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productId, days = 30 } = req.query;

      const evaluation = await demandForecastService.evaluateForecastAccuracy(
        Number(storeId),
        productId ? Number(productId) : null,
        Number(days)
      );

      res.success(evaluation, '예측 정확도 평가 완료');
    } catch (err) {
      next(err);
    }
  },

  // 특정 상품의 향후 수요 예측 조회
  getProductForecast: async (req, res, next) => {
    try {
      const { storeId, productId } = req.params;
      const { days = 7 } = req.query;

      const forecasts = await demandForecastService.getForecasts(
        Number(storeId),
        Number(productId),
        Number(days)
      );

      res.success(forecasts, '상품별 수요 예측 조회 완료');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DemandForecastController;

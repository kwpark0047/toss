const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const demandForecastController = require('./demandForecastController');
const DynamicPricingService = require('../services/DynamicPricingService');

function validateConfig(type, config) {
  if (!config || typeof config !== 'object') return false;
  switch (type) {
    case 'TIME_BASED':
      return (
        Array.isArray(config.timeSlots) &&
        config.timeSlots.every(
          (s) =>
            typeof s.startHour === 'number' &&
            typeof s.endHour === 'number' &&
            typeof s.multiplier === 'number'
        )
      );
    case 'DEMAND_BASED':
      return typeof config.demandThreshold === 'number' && typeof config.demandScore === 'number';
    case 'INVENTORY_BASED':
      return typeof config.inventoryThreshold === 'number';
    case 'WEATHER_BASED':
      return (
        Array.isArray(config.weatherConditions) &&
        config.weatherConditions.every(
          (w) =>
            typeof w.condition === 'string' &&
            (typeof w.discount === 'number' || typeof w.modifier === 'number')
        )
      );
    case 'COMPETITOR_BASED':
      return typeof config.competitorMargin === 'number';
    default:
      return true;
  }
}

const DynamicPricingController = {
  // 가격 최적화 실행/이력/경쟁사/수요예측은 demandForecastController에서 위임
  // (admin.js의 /pricing/* 라우트가 참조하는 이름으로 연결)
  runPricingOptimization: demandForecastController.startPricingOptimizationJob,
  getOptimizationJobs: demandForecastController.getPricingJobs,
  upsertCompetitorPrice: demandForecastController.addCompetitorPrice,
  getCompetitorPrices: demandForecastController.getCompetitorPrices,
  getDemandForecasts: demandForecastController.getDemandForecasts,

  getPricingRules: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const rules = await prisma.dynamic_pricing_rules.findMany({
        where: { store_id: Number(storeId) },
        include: { products: { select: { id: true, name: true, price: true } } },
        orderBy: { priority: 'asc' },
      });
      res.success(rules, '가격 규칙 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  createPricingRule: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { product_id, rule_name, rule_type, config, min_price, max_price, base_price } =
        req.body;

      if (!product_id || !rule_name || !rule_type || !config) {
        throw new AppError('product_id, rule_name, rule_type, config는 필수입니다.', 400);
      }

      if (!validateConfig(rule_type, config)) {
        throw new AppError(
          'config JSON 형식이 올바르지 않습니다. 규칙 유형에 맞는 템플릿을 확인해 주세요.',
          400
        );
      }

      const rule = await prisma.dynamic_pricing_rules.create({
        data: {
          store_id: Number(storeId),
          product_id: Number(product_id),
          rule_name,
          rule_type,
          config,
          min_price,
          max_price,
          base_price,
        },
      });

      res.success(rule, '가격 규칙 생성 완료', 201);
    } catch (err) {
      next(err);
    }
  },

  updatePricingRule: async (req, res, next) => {
    try {
      const { storeId, ruleId } = req.params;
      const { rule_name, rule_type, config, min_price, max_price, base_price, is_active } =
        req.body;

      // config가 제공된 경우 검증
      if (config !== undefined) {
        const existingRule = await prisma.dynamic_pricing_rules.findUnique({
          where: { id: Number(ruleId) },
          select: { rule_type: true },
        });
        const targetType = rule_type || existingRule?.rule_type;
        if (!validateConfig(targetType, config)) {
          throw new AppError(
            'config JSON 형식이 올바르지 않습니다. 규칙 유형에 맞는 템플릿을 확인해 주세요.',
            400
          );
        }
      }

      const rule = await prisma.dynamic_pricing_rules.update({
        where: { id: Number(ruleId), store_id: Number(storeId) },
        data: {
          ...(rule_name !== undefined && { rule_name }),
          ...(rule_type !== undefined && { rule_type }),
          ...(config !== undefined && { config }),
          ...(min_price !== undefined && { min_price }),
          ...(max_price !== undefined && { max_price }),
          ...(base_price !== undefined && { base_price }),
          ...(is_active !== undefined && { is_active }),
        },
      });

      res.success(rule, '가격 규칙 수정 완료');
    } catch (err) {
      next(err);
    }
  },

  deletePricingRule: async (req, res, next) => {
    try {
      const { storeId, ruleId } = req.params;
      await prisma.dynamic_pricing_rules.delete({
        where: { id: Number(ruleId), store_id: Number(storeId) },
      });
      res.success(null, '가격 규칙 삭제 완료');
    } catch (err) {
      next(err);
    }
  },

  getPriceLogs: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productId, days = 30 } = req.query;
      const since = new Date(Date.now() - Number(days) * 86400000);

      const where = {
        store_id: Number(storeId),
        created_at: { gte: since },
      };
      if (productId) where.product_id = Number(productId);

      const logs = await prisma.dynamic_price_logs.findMany({
        where,
        include: { products: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
        take: 100,
      });

      res.success(logs, '가격 변경 로그 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  activatePricingRules: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const service = new DynamicPricingService();
      const results = await service.activatePricingRules(Number(storeId));
      res.success({ rules_applied: results.length, details: results }, '가격 적용 완료');
    } catch (err) {
      next(err);
    }
  },

  // 수동 가격 변경 — 동적 규칙과 무관하게 특정 상품 가격을 즉시 변경하고 이력에 남긴다.
  applyManualPriceChange: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { productId, newPrice, reason } = req.body;

      const product = await prisma.products.findFirst({
        where: { id: Number(productId), store_id: Number(storeId) },
      });
      if (!product) return next(new AppError('해당 상품을 찾을 수 없습니다.', 404));

      const price = Math.round(Number(newPrice));
      if (!Number.isFinite(price) || price < 0) {
        return next(new AppError('유효하지 않은 가격입니다.', 400));
      }

      if (price !== product.price) {
        await prisma.dynamic_price_logs.create({
          data: {
            store_id: Number(storeId),
            product_id: Number(product.id),
            old_price: product.price,
            new_price: price,
            trigger_type: 'MANUAL',
            confidence_score: 1.0,
            ai_reasoning: reason || '수동 가격 변경',
            applied: true,
            applied_at: new Date(),
          },
        });
        await prisma.products.update({
          where: { id: Number(product.id) },
          data: { price },
        });
      }

      res.success(
        {
          product_id: product.id,
          product_name: product.name,
          old_price: product.price,
          new_price: price,
        },
        '수동 가격 변경 완료'
      );
    } catch (err) {
      next(err);
    }
  },
};

module.exports = DynamicPricingController;

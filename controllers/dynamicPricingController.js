const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const DynamicPricingController = {
    getPricingRules: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const rules = await prisma.dynamic_pricing_rules.findMany({
                where: { store_id: Number(storeId) },
                include: { products: { select: { id: true, name: true, price: true } } },
                orderBy: { priority: 'asc' }
            });
            res.success(rules, '가격 규칙 조회 완료');
        } catch (err) {
            next(err);
        }
    },

    createPricingRule: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const {
                product_id, rule_name, rule_type, config,
                min_price, max_price, base_price
            } = req.body;

            if (!product_id || !rule_name || !rule_type || !config) {
                throw new AppError('product_id, rule_name, rule_type, config는 필수입니다.', 400);
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
                }
            });

            res.success(rule, '가격 규칙 생성 완료', 201);
        } catch (err) {
            next(err);
        }
    },

    updatePricingRule: async (req, res, next) => {
        try {
            const { storeId, ruleId } = req.params;
            const { rule_name, rule_type, config, min_price, max_price, base_price, is_active } = req.body;

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
                }
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
                where: { id: Number(ruleId), store_id: Number(storeId) }
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
                created_at: { gte: since }
            };
            if (productId) where.product_id = Number(productId);

            const logs = await prisma.dynamic_price_logs.findMany({
                where,
                include: { products: { select: { id: true, name: true } } },
                orderBy: { created_at: 'desc' },
                take: 100
            });

            res.success(logs, '가격 변경 로그 조회 완료');
        } catch (err) {
            next(err);
        }
    },

    applyManualPriceChange: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { productId, newPrice, reason } = req.body;

            if (!productId || newPrice === undefined) {
                throw new AppError('productId, newPrice는 필수입니다.', 400);
            }

            const product = await prisma.products.findFirst({
                where: { id: Number(productId), store_id: Number(storeId) }
            });
            if (!product) {
                throw new AppError('상품을 찾을 수 없습니다.', 404);
            }

            const priceLog = await prisma.dynamic_price_logs.create({
                data: {
                    store_id: Number(storeId),
                    product_id: Number(product.id),
                    old_price: product.price,
                    new_price: Number(newPrice),
                    trigger_type: 'MANUAL',
                    trigger_data: reason ? { reason } : undefined,
                    confidence_score: 1.0,
                    applied: true,
                    applied_at: new Date()
                }
            });

            await prisma.products.update({
                where: { id: Number(product.id) },
                data: { price: Number(newPrice) }
            });

            res.success({ log_id: priceLog.id, product_id: product.id, old_price: product.price, new_price: Number(newPrice) }, '수동 가격 변경 완료');
        } catch (err) {
            next(err);
        }
    },

    runPricingOptimization: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { jobType = 'FULL_OPTIMIZATION' } = req.body;

            const validJobTypes = ['FULL_OPTIMIZATION', 'INCREMENTAL_UPDATE', 'DEMAND_FORECAST', 'COMPETITOR_SYNC'];
            if (!validJobTypes.includes(jobType)) {
                throw new AppError(`jobType은 ${validJobTypes.join(', ')} 중 하나여야 합니다.`, 400);
            }

            const job = await prisma.pricing_optimization_jobs.create({
                data: {
                    store_id: Number(storeId),
                    job_type: jobType,
                    status: 'PENDING'
                }
            });

            res.success(job, '가격 최적화 작업이 등록되었습니다.', 201);
        } catch (err) {
            next(err);
        }
    },

    getOptimizationJobs: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { limit = 50 } = req.query;

            const jobs = await prisma.pricing_optimization_jobs.findMany({
                where: { store_id: Number(storeId) },
                orderBy: { created_at: 'desc' },
                take: Number(limit)
            });

            res.success(jobs, '최적화 작업 목록 조회 완료');
        } catch (err) {
            next(err);
        }
    },

    upsertCompetitorPrice: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { id, productName, competitorName, competitorPrice, competitorUrl } = req.body;

            if (!productName || !competitorName || competitorPrice === undefined) {
                throw new AppError('productName, competitorName, competitorPrice는 필수입니다.', 400);
            }

            const data = {
                product_name: productName,
                competitor_name: competitorName,
                competitor_price: Number(competitorPrice),
                competitor_url: competitorUrl || null,
                last_checked: new Date()
            };

            let result;
            if (id) {
                result = await prisma.competitor_prices.update({
                    where: { id: Number(id), store_id: Number(storeId) },
                    data
                });
            } else {
                result = await prisma.competitor_prices.create({
                    data: { store_id: Number(storeId), ...data }
                });
            }

            res.success(result, '경쟁사 가격 저장 완료', id ? 200 : 201);
        } catch (err) {
            next(err);
        }
    },

    getCompetitorPrices: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { productName, isActive } = req.query;

            const where = { store_id: Number(storeId) };
            if (productName) where.product_name = { contains: productName };
            if (isActive !== undefined) where.is_active = isActive === 'true';

            const competitors = await prisma.competitor_prices.findMany({
                where,
                orderBy: { last_checked: 'desc' }
            });

            res.success(competitors, '경쟁사 가격 목록 조회 완료');
        } catch (err) {
            next(err);
        }
    },

    getDemandForecasts: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const { productId, days = 7 } = req.query;

            const since = new Date(Date.now() - Number(days) * 86400000);
            const where = {
                store_id: Number(storeId),
                forecast_date: { gte: since }
            };
            if (productId) where.product_id = Number(productId);

            const forecasts = await prisma.demand_forecasts.findMany({
                where,
                include: { products: { select: { id: true, name: true } } },
                orderBy: { forecast_date: 'asc' },
                take: Number(days) * 5
            });

            res.success(forecasts, '수요 예측 목록 조회 완료');
        } catch (err) {
            next(err);
        }
    },

    activatePricingRules: async (req, res, next) => {
        try {
            const { storeId } = req.params;
            const activeRules = await prisma.dynamic_pricing_rules.findMany({
                where: { store_id: Number(storeId), is_active: true },
                include: { products: true }
            });

            const results = [];
            for (const rule of activeRules) {
                const product = rule.products;
                if (!product) continue;

                const currentPrice = product.price;
                let newPrice = currentPrice;

                switch (rule.rule_type) {
                    case 'TIME_BASED':
                        newPrice = applyTimeBasedPricing(currentPrice, rule.config);
                        break;
                    case 'DEMAND_BASED':
                        newPrice = applyDemandBasedPricing(currentPrice, rule.config);
                        break;
                    case 'COMPETITOR_BASED':
                        newPrice = applyCompetitorBasedPricing(currentPrice, rule.config, storeId, product.name);
                        break;
                    case 'INVENTORY_BASED':
                        newPrice = applyInventoryBasedPricing(currentPrice, rule.config, product);
                        break;
                    case 'WEATHER_BASED':
                        newPrice = applyWeatherBasedPricing(currentPrice, rule.config);
                        break;
                }

                const finalPrice = Math.max(rule.min_price || 0, Math.min(rule.max_price || Infinity, newPrice));

                if (finalPrice !== currentPrice) {
                    const priceLog = await prisma.dynamic_price_logs.create({
                        data: {
                            store_id: Number(storeId),
                            product_id: Number(product.id),
                            rule_id: rule.id,
                            old_price: currentPrice,
                            new_price: finalPrice,
                            trigger_type: 'SCHEDULED',
                            confidence_score: 0.8,
                            applied: true,
                            applied_at: new Date()
                        }
                    });

                    await prisma.products.update({
                        where: { id: Number(product.id) },
                        data: { price: finalPrice }
                    });

                    results.push({ product_id: product.id, product_name: product.name, old_price: currentPrice, new_price: finalPrice, log_id: priceLog.id });
                }
            }

            res.success({ rules_applied: results.length, details: results }, '가격 적용 완료');
        } catch (err) {
            next(err);
        }
    }
};

function applyTimeBasedPricing(currentPrice, config) {
    if (!config || !config.timeSlots) return currentPrice;
    const hour = new Date().getHours();
    const slot = config.timeSlots.find(s => hour >= s.startHour && hour < s.endHour);
    if (!slot || !slot.multiplier) return currentPrice;
    return Math.round(currentPrice * slot.multiplier);
}

function applyDemandBasedPricing(currentPrice, config) {
    if (!config || !config.demandThreshold) return currentPrice;
    const demandScore = config.demandScore || 1.0;
    if (demandScore > config.demandThreshold) {
        return Math.round(currentPrice * (1 + (demandScore - config.demandThreshold) * 0.2));
    }
    return currentPrice;
}

function applyCompetitorBasedPricing(currentPrice, config) {
    if (!config || !config.competitorMargin) return currentPrice;
    return Math.round(currentPrice * (1 - config.competitorMargin));
}

function applyInventoryBasedPricing(currentPrice, config, product) {
    if (!config || !config.inventoryThreshold) return currentPrice;
    const stock = product.stock_quantity || 0;
    if (stock < config.inventoryThreshold) {
        return Math.round(currentPrice * 1.15);
    }
    return currentPrice;
}

function applyWeatherBasedPricing(currentPrice, config) {
    if (!config || !config.weatherConditions) return currentPrice;
    return currentPrice;
}

module.exports = DynamicPricingController;
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
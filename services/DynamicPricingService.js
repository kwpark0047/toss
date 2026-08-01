const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class DynamicPricingService {
  async getPricingRules(storeId) {
    return prisma.dynamic_pricing_rules.findMany({
      where: { store_id: Number(storeId) },
      include: { products: { select: { id: true, name: true, price: true, category_id: true } } },
      orderBy: { priority: 'asc' },
    });
  }

  async createPricingRule(storeId, data) {
    const { product_id, rule_name, rule_type, config, min_price, max_price, base_price } = data;
    return prisma.dynamic_pricing_rules.create({
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
  }

  async updatePricingRule(storeId, ruleId, data) {
    const { rule_name, rule_type, config, min_price, max_price, base_price, is_active } = data;
    return prisma.dynamic_pricing_rules.update({
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
  }

  async deletePricingRule(storeId, ruleId) {
    return prisma.dynamic_pricing_rules.delete({
      where: { id: Number(ruleId), store_id: Number(storeId) },
    });
  }

  async getPriceLogs(storeId, { productId, days = 30 }) {
    const since = new Date(Date.now() - Number(days) * 86400000);
    const where = {
      store_id: Number(storeId),
      created_at: { gte: since },
    };
    if (productId) where.product_id = Number(productId);

    return prisma.dynamic_price_logs.findMany({
      where,
      include: { products: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async applyManualPriceChange(storeId, { productId, newPrice, reason = '수동 가격 변경' }) {
    const product = await prisma.products.findFirst({
      where: { id: Number(productId), store_id: Number(storeId) },
    });
    if (!product) throw new Error('해당 상품을 찾을 수 없습니다.');

    const price = Math.round(Number(newPrice));
    if (!Number.isFinite(price) || price < 0) throw new Error('유효하지 않은 가격입니다.');

    if (price !== product.price) {
      await prisma.dynamic_price_logs.create({
        data: {
          store_id: Number(storeId),
          product_id: Number(product.id),
          old_price: product.price,
          new_price: price,
          trigger_type: 'MANUAL',
          confidence_score: 1.0,
          ai_reasoning: reason,
          applied: true,
          applied_at: new Date(),
        },
      });
      await prisma.products.update({
        where: { id: Number(product.id) },
        data: { price },
      });
      logger.info(
        `[DynamicPricing] Manual price change: ${product.name} ${product.price} -> ${price} (${reason})`
      );
    }

    return {
      product_id: product.id,
      product_name: product.name,
      old_price: product.price,
      new_price: price,
    };
  }

  async activatePricingRules(storeId) {
    const activeRules = await prisma.dynamic_pricing_rules.findMany({
      where: { store_id: Number(storeId), is_active: true },
      include: { products: true },
    });

    const results = [];
    for (const rule of activeRules) {
      const product = rule.products;
      if (!product) continue;

      const currentPrice = product.price;
      const newPrice = this.applyRule(currentPrice, rule.rule_type, rule.config, product);

      const minPrice = rule.min_price;
      const maxPrice = rule.max_price;
      const finalPrice = Math.max(minPrice || 0, Math.min(maxPrice || Infinity, newPrice));

      if (finalPrice !== currentPrice) {
        try {
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
              applied_at: new Date(),
            },
          });

          await prisma.products.update({
            where: { id: Number(product.id) },
            data: { price: finalPrice },
          });

          results.push({
            product_id: product.id,
            product_name: product.name,
            old_price: currentPrice,
            new_price: finalPrice,
            log_id: priceLog.id,
          });

          logger.info(
            `[DynamicPricing] Price updated: ${product.name} ${currentPrice} -> ${finalPrice} (rule: ${rule.rule_name})`
          );
        } catch (err) {
          logger.error(`[DynamicPricing] Failed to apply rule ${rule.id}: ${err.message}`);
        }
      }
    }

    return results;
  }

  applyRule(currentPrice, ruleType, config, product) {
    switch (ruleType) {
      case 'TIME_BASED':
        return this.applyTimeBased(currentPrice, config);
      case 'DEMAND_BASED':
        return this.applyDemandBased(currentPrice, config);
      case 'COMPETITOR_BASED':
        return this.applyCompetitorBased(currentPrice, config);
      case 'INVENTORY_BASED':
        return this.applyInventoryBased(currentPrice, config, product);
      case 'WEATHER_BASED':
        return this.applyWeatherBased(currentPrice, config);
      default:
        return currentPrice;
    }
  }

  applyTimeBased(currentPrice, config) {
    if (!config || !config.timeSlots) return currentPrice;
    const hour = new Date().getHours();
    const slot = config.timeSlots.find((s) => hour >= s.startHour && hour < s.endHour);
    if (!slot || !slot.multiplier) return currentPrice;
    return Math.round(currentPrice * slot.multiplier);
  }

  applyDemandBased(currentPrice, config) {
    if (!config || !config.demandThreshold) return currentPrice;
    const demandScore = config.demandScore || 1.0;
    if (demandScore > config.demandThreshold) {
      return Math.round(currentPrice * (1 + (demandScore - config.demandThreshold) * 0.2));
    }
    return currentPrice;
  }

  applyCompetitorBased(currentPrice, config) {
    if (!config || typeof config.competitorMargin !== 'number') return currentPrice;
    return Math.round(currentPrice * (1 - config.competitorMargin));
  }

  applyInventoryBased(currentPrice, config, product) {
    if (!config || !config.inventoryThreshold) return currentPrice;
    const stock = product.stock_quantity || 0;
    if (stock < config.inventoryThreshold) {
      return Math.round(currentPrice * 1.15);
    }
    return currentPrice;
  }

  applyWeatherBased(currentPrice, config) {
    if (!config) return currentPrice;
    return currentPrice;
  }
}

module.exports = new DynamicPricingService();

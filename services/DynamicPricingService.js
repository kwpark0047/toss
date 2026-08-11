const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const weatherService = require('./weatherService');

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

    // WEATHER_BASED 규칙이 있으면 실시간 날씨 컨텍스트 로드 (1회)
    const hasWeatherRule = activeRules.some((r) => r.rule_type === 'WEATHER_BASED');
    const weatherContext = hasWeatherRule
      ? await weatherService.getEnhancedWeatherContext('108').catch(() => null)
      : null;

    const results = [];
    for (const rule of activeRules) {
      const product = rule.products;
      if (!product) continue;

      const currentPrice = product.price;
      const newPrice = this.applyRule(
        currentPrice,
        rule.rule_type,
        rule.config,
        product,
        weatherContext
      );

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
              trigger_type: 'WEATHER_CHANGE',
              trigger_data: weatherContext
                ? {
                    temp: weatherContext.temp,
                    condition: weatherContext.condition,
                    alerts: weatherContext.alerts,
                  }
                : null,
              ai_reasoning: weatherContext
                ? `날씨 기반 자동 가격 조정 (${weatherContext.condition} ${weatherContext.temp}°C${
                    weatherContext.alerts?.length ? ', ' + weatherContext.alerts.join(', ') : ''
                  })`
                : '날씨 기반 자동 가격 조정',
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

  /**
   * 모든 매장의 활성 동적가격 규칙을 실행 (스케줄러용)
   * 각 매장별 activatePricingRules를 호출하고 결과를 집계한다.
   */
  async activateAllStores() {
    const stores = await prisma.dynamic_pricing_rules
      .findMany({
        where: { is_active: true },
        distinct: ['store_id'],
        select: { store_id: true },
      })
      .then((rows) => rows.map((r) => r.store_id));

    const summary = { stores_processed: 0, price_changes: [] };
    for (const storeId of stores) {
      try {
        const results = await this.activatePricingRules(storeId);
        if (results.length > 0) {
          summary.stores_processed += 1;
          summary.price_changes.push(...results);
        }
      } catch (err) {
        logger.error(`[DynamicPricing] 스케줄러 처리 실패 (store ${storeId}): ${err.message}`);
      }
    }

    if (summary.price_changes.length > 0) {
      logger.info(
        `[DynamicPricing] 스케줄러 완료 — ${summary.stores_processed}개 매장, ${summary.price_changes.length}개 가격 변경`
      );
    }
    return summary;
  }

  applyRule(currentPrice, ruleType, config, product, weatherContext) {
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
        return this.applyWeatherBased(currentPrice, config, weatherContext);
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

  applyWeatherBased(currentPrice, config, weatherContext) {
    if (!config || !weatherContext) return currentPrice;

    // config.weatherConditions: [{ condition, discount, modifier }]
    //   condition: 'heat_wave' | 'cold_wave' | 'rain' | 'hot' | 'clear' | 'alert'
    //   discount: 0~1 (할인율 예: 0.9 → 10% 할인), modifier: 곱셈 계수 예: 1.1 → 10% 인상
    const conditions = Array.isArray(config.weatherConditions) ? config.weatherConditions : [];
    if (conditions.length === 0) return currentPrice;

    const temp = weatherContext.temp;
    const isRaining = weatherContext.isRaining || weatherContext.rain > 0;
    const alerts = Array.isArray(weatherContext.alerts) ? weatherContext.alerts : [];

    // 현재 날씨 상태 판정
    let matched = null;
    for (const c of conditions) {
      const cond = c.condition;
      let hit = false;
      switch (cond) {
        case 'heat_wave':
          hit = temp >= 33 || alerts.includes('폭염특보') || alerts.includes('폭염주의보');
          break;
        case 'cold_wave':
          hit = temp <= 0 || alerts.includes('한파특보') || alerts.includes('한파주의보');
          break;
        case 'rain':
          hit = isRaining || alerts.includes('비 소식');
          break;
        case 'hot':
          hit = temp >= 28;
          break;
        case 'clear':
          hit = !isRaining && temp > 0;
          break;
        case 'alert':
          hit = alerts.length > 0;
          break;
        default:
          break;
      }
      if (hit) {
        matched = c;
        break;
      }
    }

    if (!matched) return currentPrice;

    // discount(0~1) → 할인, modifier(곱셈) → 인상/할인
    if (typeof matched.modifier === 'number' && matched.modifier > 0) {
      return Math.round(currentPrice * matched.modifier);
    }
    if (typeof matched.discount === 'number' && matched.discount > 0 && matched.discount < 1) {
      return Math.round(currentPrice * matched.discount);
    }

    return currentPrice;
  }
}

module.exports = new DynamicPricingService();

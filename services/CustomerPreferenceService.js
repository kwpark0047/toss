const CustomerPreference = require('../repositories/CustomerPreference');
const Product = require('../repositories/Product');
const Order = require('../repositories/Order');
const aiService = require('./aiService');
const logger = require('../utils/logger');

class CustomerPreferenceService {
  /**
   * 고객 선호도 프로파일 조회 (없으면 생성)
   */
  async getProfile(storeId, customerPhone) {
    return await CustomerPreference.findOrCreate(storeId, customerPhone);
  }

  /**
   * 주문 완료 시 선호도 학습 (비동기 처리)
   */
  async learnFromOrder(storeId, customerPhone, orderItems) {
    try {
      // 주문 아이템에 카테고리/맛/맵기 정보 보강
      const enrichedItems = await Promise.all(
        orderItems.map(async (item) => {
          const product = await Product.findById(item.product_id || item.id);
          return {
            category: product?.categories?.name || product?.category,
            taste: product?.taste_profile || item.taste,
            spicy_level: product?.spicy_level || item.spicy_level,
          };
        })
      );

      await CustomerPreference.incrementFromOrder(storeId, customerPhone, enrichedItems);

      // 주문 패턴 분석 (시간대, 요일, 평균 주문액, 빈도)
      const orders = await Order.findByCustomer(customerPhone);
      if (orders.length > 0) {
        const patterns = this.analyzeOrderPatterns(orders);
        await CustomerPreference.updateOrderPatterns(storeId, customerPhone, patterns);
      }
    } catch (error) {
      logger.warn(`[PreferenceService] 주문 학습 실패: ${error.message}`);
    }
  }

  /**
   * 주문 패턴 분석
   */
  analyzeOrderPatterns(orders) {
    const hourCounts = Array(24).fill(0);
    const dayCounts = Array(7).fill(0);
    let totalAmount = 0;
    let totalOrders = 0;

    for (const order of orders) {
      const d = new Date(order.created_at);
      hourCounts[d.getHours()]++;
      dayCounts[d.getDay()]++;
      totalAmount += order.total_amount || 0;
      totalOrders++;
    }

    const topHours = hourCounts
      .map((c, h) => ({ hour: h, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((h) => h.hour);

    const topDays = dayCounts
      .map((c, d) => ({ day: d, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((d) => d.day);

    return {
      preferred_hours: topHours,
      preferred_days: topDays,
      avg_order_value: totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0,
      order_frequency: totalOrders,
      last_order_at: orders[0]?.created_at || null,
    };
  }

  /**
   * AI 추천용 컨텍스트 구성 (개인화 프로파일 반영)
   */
  async buildRecommendationContext(storeId, customerPhone, context = {}) {
    const profile = await this.getProfile(storeId, customerPhone);

    return {
      ...context,
      preferences: {
        categories: profile.preferred_categories || [],
        tastes: profile.preferred_tastes || [],
        spicy_tolerance: profile.spiciness_tolerance || 1,
        price_sensitivity: profile.price_sensitivity || 'MEDIUM',
        dietary: profile.dietary_restrictions || [],
      },
      favorite_ids: profile.favorite_items || [],
      order_patterns: profile.order_patterns || {},
    };
  }

  /**
   * 개인화 추천 실행 (AI 서비스 연동)
   */
  async getPersonalizedRecommendations(storeId, customerPhone, menuList, context = {}) {
    const enrichedContext = await this.buildRecommendationContext(storeId, customerPhone, context);

    // 즐겨찾기 메뉴 우선 포함
    const favoriteMenus = menuList.filter((m) => enrichedContext.favorite_ids.includes(m.id));

    // AI 추천 요청
    const aiRecs = await aiService.recommendMenus(enrichedContext, menuList);

    // 결과 병합: 즐겨찾기 + AI 추천 (중복 제거, 최대 5개)
    const seen = new Set();
    const merged = [];

    for (const m of favoriteMenus) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push({
          id: m.id,
          name: m.name,
          price: m.price,
          reason: '자주 주문하시는 메뉴예요 💖',
          is_favorite: true,
        });
      }
    }

    for (const rec of aiRecs) {
      if (merged.length >= 5) break;
      const menu = menuList.find((m) => m.id === rec.id);
      if (menu && !seen.has(menu.id)) {
        seen.add(menu.id);
        merged.push({
          id: menu.id,
          name: menu.name,
          price: menu.price,
          reason: rec.reason,
          is_favorite: false,
        });
      }
    }

    // 다양성 보장: 카테고리 중복 제한 (최대 2개씩)
    return this.ensureDiversity(merged, menuList, seen);
  }

  /**
   * 카테고리 다양성 보장 (동일 카테고리 최대 2개)
   */
  ensureDiversity(recommendations, menuList, seen) {
    const catCounts = {};
    const result = [];

    for (const rec of recommendations) {
      const menu = menuList.find((m) => m.id === rec.id);
      const cat = menu?.categories?.name || '기타';
      const count = catCounts[cat] || 0;
      if (count < 2) {
        catCounts[cat] = count + 1;
        result.push({ ...rec, category: cat });
      }
    }

    // 부족하면 다른 카테고리에서 채우기
    if (result.length < 3) {
      for (const menu of menuList) {
        if (result.length >= 3) break;
        if (!seen.has(menu.id)) {
          const cat = menu.categories?.name || '기타';
          if ((catCounts[cat] || 0) < 2) {
            catCounts[cat] = (catCounts[cat] || 0) + 1;
            result.push({
              id: menu.id,
              name: menu.name,
              price: menu.price,
              reason: '새로 추천해 드리는 메뉴예요 ✨',
              category: cat,
            });
          }
        }
      }
    }

    return result.slice(0, 5);
  }

  /**
   * 즐겨찾기 토글
   */
  async toggleFavorite(storeId, customerPhone, menuId) {
    return await CustomerPreference.toggleFavorite(storeId, customerPhone, menuId);
  }

  /**
   * 매장 고객 선호도 통계 (관리자용)
   */
  async getStoreStats(storeId) {
    return await CustomerPreference.getStoreStats(storeId);
  }
}

module.exports = new CustomerPreferenceService();

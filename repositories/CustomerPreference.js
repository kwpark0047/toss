const prisma = require('../config/prisma');

class CustomerPreferenceRepository {
  /**
   * 고객 선호도 조회 (전화번호 또는 toss_user_key로, 없으면 기본값으로 생성)
   */
  async findOrCreateByPhoneOrTossKey(storeId, customerPhone, tossUserKey) {
    let pref = null;

    if (customerPhone) {
      pref = await prisma.customer_preferences.findUnique({
        where: {
          store_id_customer_phone: { store_id: storeId, customer_phone: customerPhone },
        },
      });
    }

    if (!pref && tossUserKey) {
      // toss_user_key로 고객 찾아서 해당 전화번호의 선호도 사용
      const storeCustomer = await prisma.store_customers.findFirst({
        where: { store_id: storeId, toss_user_key: tossUserKey },
        select: { customer_phone: true },
      });

      if (storeCustomer) {
        pref = await prisma.customer_preferences.findUnique({
          where: {
            store_id_customer_phone: {
              store_id: storeId,
              customer_phone: storeCustomer.customer_phone,
            },
          },
        });
      }
    }

    if (!pref && customerPhone) {
      // 기본 생성 (전화번호 기준)
      pref = await prisma.customer_preferences.create({
        data: {
          store_id: storeId,
          customer_phone: customerPhone,
          preferred_categories: [],
          preferred_tastes: [],
          spicy_tolerance: 1,
          price_sensitivity: 'MEDIUM',
          dietary_restrictions: [],
          favorite_items: [],
          order_patterns: {},
        },
      });
    }

    return pref;
  }

  /**
   * 고객 선호도 조회 (없으면 기본값으로 생성)
   */
  async findOrCreate(storeId, customerPhone) {
    return this.findOrCreateByPhoneOrTossKey(storeId, customerPhone, null);
  }

  /**
   * 고객 선호도 업데이트
   */
  async update(storeId, customerPhone, data) {
    const pref = await prisma.customer_preferences.update({
      where: {
        store_id_customer_phone: { store_id: storeId, customer_phone: customerPhone },
      },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
    return pref;
  }

  /**
   * 선호 카테고리/맛 증분 업데이트 (주문 시 호출)
   */
  async incrementFromOrder(storeId, customerPhone, orderItems) {
    const pref = await this.findOrCreate(storeId, customerPhone);

    const categoryCounts = {};
    const tasteCounts = {};
    let totalSpicy = 0;
    let spicyCount = 0;

    for (const item of orderItems) {
      if (item.category) categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      if (item.taste) tasteCounts[item.taste] = (tasteCounts[item.taste] || 0) + 1;
      if (item.spicy_level != null) {
        totalSpicy += item.spicy_level;
        spicyCount++;
      }
    }

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const topTastes = Object.entries(tasteCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([taste]) => taste);

    const avgSpicy =
      spicyCount > 0 ? Math.round(totalSpicy / spicyCount) : pref.spiciness_tolerance;

    return this.update(storeId, customerPhone, {
      preferred_categories: topCategories,
      preferred_tastes: topTastes,
      spicy_tolerance: avgSpicy,
    });
  }

  /**
   * 즐겨찾기 메뉴 토글
   */
  async toggleFavorite(storeId, customerPhone, menuId) {
    const pref = await this.findOrCreate(storeId, customerPhone);
    const favorites = pref.favorite_items || [];
    const isFavorite = favorites.includes(menuId);
    const newFavorites = isFavorite
      ? favorites.filter((id) => id !== menuId)
      : [...favorites, menuId].slice(-20); // 최대 20개

    return this.update(storeId, customerPhone, { favorite_items: newFavorites });
  }

  /**
   * 주문 패턴 분석 결과 저장
   */
  async updateOrderPatterns(storeId, customerPhone, patterns) {
    return this.update(storeId, customerPhone, { order_patterns: patterns });
  }

  /**
   * 매장별 전체 고객 선호도 통계 (관리자용)
   */
  async getStoreStats(storeId) {
    const prefs = await prisma.customer_preferences.findMany({
      where: { store_id: storeId },
      select: {
        preferred_categories: true,
        preferred_tastes: true,
        spicy_tolerance: true,
        price_sensitivity: true,
      },
    });

    const categoryCounts = {};
    const tasteCounts = {};
    const spicySum = prefs.reduce((sum, p) => sum + (p.spiciness_tolerance || 1), 0);
    const priceDist = { LOW: 0, MEDIUM: 0, HIGH: 0 };

    for (const p of prefs) {
      for (const cat of p.preferred_categories || [])
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      for (const taste of p.preferred_tastes || [])
        tasteCounts[taste] = (tasteCounts[taste] || 0) + 1;
      priceDist[p.price_sensitivity || 'MEDIUM']++;
    }

    return {
      top_categories: Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      top_tastes: Object.entries(tasteCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      avg_spicy_tolerance: prefs.length > 0 ? Math.round(spicySum / prefs.length) : 1,
      price_sensitivity_dist: priceDist,
      total_customers: prefs.length,
    };
  }
}

module.exports = new CustomerPreferenceRepository();

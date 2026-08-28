const prisma = require('../config/prisma');
const aiService = require('./aiService');
const logger = require('../utils/logger');

/**
 * AI 기반 개인화 추천 엔진
 * - 고객 세그먼트별 맞춤 추천
 * - 주문 이력 기반 협업 필터링
 * - 날씨/시간/계절 컨텍스트 반영
 * - Gemini API를 통한 지능형 추천 사유 생성
 */
class RecommendationEngine {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5분
  }

  /**
   * 매장별 개인화 추천 생성 및 저장
   */
  async generateAndStoreRecommendations(storeId, options = {}) {
    const {
      segmentId = null,
      customerPhone = null,
      recommendationType = 'PRODUCT',
      limit = 10,
    } = options;

    try {
      // 1. 매장 기본 데이터 수집
      const storeData = await this._gatherStoreData(storeId, segmentId, customerPhone);

      if (!storeData.products.length) {
        logger.warn({ storeId }, '추천 생성 불가: 상품 데이터 없음');
        return [];
      }

      // 2. 추천 대상 고객 프로필 구성
      const customerProfile = this._buildCustomerProfile(storeData, customerPhone, segmentId);

      // 3. AI 기반 추천 생성
      const aiRecommendations = await this._generateAIRecommendations(
        storeData,
        customerProfile,
        recommendationType,
        limit
      );

      // 4. 추천 결과 DB 저장
      const stored = await this._storeRecommendations(
        storeId,
        aiRecommendations,
        segmentId,
        customerPhone
      );

      logger.info({ storeId, count: stored.length }, 'AI 개인화 추천 생성 완료');
      return stored;
    } catch (error) {
      logger.error({ storeId, error: error.message }, '추천 생성 실패');
      throw error;
    }
  }

  /**
   * 특정 고객을 위한 실시간 추천 조회 (캐시 활용)
   */
  async getRecommendationsForCustomer(storeId, customerPhone, options = {}) {
    const cacheKey = `rec_${storeId}_${customerPhone}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const recommendations = await this.generateAndStoreRecommendations(storeId, {
        customerPhone,
        ...options,
      });

      this.cache.set(cacheKey, { data: recommendations, timestamp: Date.now() });
      return recommendations;
    } catch (error) {
      logger.error({ storeId, customerPhone, error: error.message }, '고객 추천 조회 실패');
      // 폴백: 인기 상품 기반 추천
      return this._getFallbackRecommendations(storeId, options.limit || 5);
    }
  }

  /**
   * 매장 데이터 수집 (주문 이력, 상품, 고객 세그먼트 등)
   */
  async _gatherStoreData(storeId, segmentId, customerPhone) {
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [
      products,
      recentOrders,
      customerSegments,
      customerProfile,
      trendingProducts,
      weatherContext,
    ] = await Promise.all([
      // 활성 상품 목록
      prisma.products.findMany({
        where: { store_id: storeId, is_active: true, is_sold_out: false },
        select: {
          id: true,
          name: true,
          price: true,
          category_id: true,
          image_url: true,
          description: true,
          category: { select: { name: true } },
        },
      }),

      // 최근 30일 주문 이력
      prisma.orders.findMany({
        where: {
          store_id: storeId,
          created_at: { gte: since30Days },
          status: { not: 'cancelled' },
        },
        select: {
          id: true,
          customer_phone: true,
          total_amount: true,
          created_at: true,
          order_items: {
            select: { product_id: true, product_name: true, quantity: true, price: true },
          },
        },
      }),

      // 고객 세그먼트
      prisma.customer_segments.findMany({
        where: { store_id: storeId, is_active: true },
      }),

      // 특정 고객 프로필 (있는 경우)
      customerPhone
        ? prisma.customer_personalizations.findFirst({
            where: {
              store_id: storeId,
              customer_phone: customerPhone.replace(/[^0-9]/g, ''),
            },
            include: { segments: true },
          })
        : null,

      // 인기 상품 (주문 빈도 기준)
      this._getTrendingProducts(storeId, since30Days),

      // 현재 날씨 컨텍스트 (가능한 경우)
      this._getWeatherContext(),
    ]);

    return {
      products,
      recentOrders,
      customerSegments,
      customerProfile,
      trendingProducts,
      weatherContext,
    };
  }

  /**
   * 고객 프로필 구성
   */
  _buildCustomerProfile(storeData, customerPhone, segmentId) {
    const { recentOrders, customerProfile, customerSegments } = storeData;

    // 고객의 주문 이력 필터링
    const customerOrders = customerPhone
      ? recentOrders.filter((o) => o.customer_phone === customerPhone.replace(/[^0-9]/g, ''))
      : [];

    // 세그먼트 정보
    let segment = null;
    if (segmentId) {
      segment = customerSegments.find((s) => s.id === segmentId);
    } else if (customerProfile?.segment_id) {
      segment = customerSegments.find((s) => s.id === customerProfile.segment_id);
    }

    // 선호 카테고리 분석
    const categoryPreference = this._analyzeCategoryPreference(customerOrders, storeData.products);

    // 평균 주문 금액
    const avgOrderValue = customerOrders.length
      ? customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / customerOrders.length
      : 0;

    // 주문 빈도 (월간)
    const monthlyFrequency = customerOrders.length / 3; // 90일 / 30일

    return {
      phone: customerPhone,
      segment,
      orders: customerOrders,
      categoryPreference,
      avgOrderValue,
      monthlyFrequency,
      preferences: customerProfile?.preferences || {},
      customDiscount: customerProfile?.custom_discount || 0,
    };
  }

  /**
   * 카테고리별 선호도 분석
   */
  _analyzeCategoryPreference(orders, products) {
    const productCategoryMap = {};
    products.forEach((p) => {
      if (p.category_id) productCategoryMap[p.id] = p.category?.name || '기타';
    });

    const categoryCount = {};
    orders.forEach((order) => {
      order.order_items?.forEach((item) => {
        const category = productCategoryMap[item.product_id] || '기타';
        categoryCount[category] = (categoryCount[category] || 0) + (item.quantity || 1);
      });
    });

    // 상위 3개 카테고리 반환
    return Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * 인기 상품 추출
   */
  async _getTrendingProducts(storeId, since) {
    const orderItems = await prisma.order_items.findMany({
      where: {
        orders: {
          store_id: storeId,
          created_at: { gte: since },
          status: { not: 'cancelled' },
        },
      },
      select: { product_id: true, quantity: true },
    });

    const productPopularity = {};
    orderItems.forEach((item) => {
      if (item.product_id) {
        productPopularity[item.product_id] =
          (productPopularity[item.product_id] || 0) + item.quantity;
      }
    });

    return Object.entries(productPopularity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ productId: Number(id), orderCount: count }));
  }

  /**
   * 날씨 컨텍스트 가져오기 (외부 API 연동 시 확장 가능)
   */
  async _getWeatherContext() {
    // TODO: 실제 날씨 API 연동 시 구현
    return {
      temperature: 20,
      condition: 'clear',
      season: this._getCurrentSeason(),
    };
  }

  _getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  /**
   * AI 기반 추천 생성
   */
  async _generateAIRecommendations(storeData, customerProfile, type, limit) {
    const { products, trendingProducts, weatherContext } = storeData;
    const { segment, categoryPreference, avgOrderValue, preferences } = customerProfile;

    // 상품 목록 준비
    const menuList = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name || '기타',
      price: p.price,
      description: p.description || '',
    }));

    // 컨텍스트 구성
    const context = {
      preferences: this._formatPreferences(categoryPreference, preferences),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      weather: weatherContext.condition,
      temperature: weatherContext.temperature,
      season: weatherContext.season,
      timePeriod: this._getTimePeriod(),
      pastOrders: customerProfile.orders
        .slice(0, 10)
        .map((o) => o.order_items.map((i) => i.product_name).join(', '))
        .join('; '),
      trendingItems: trendingProducts
        .slice(0, 5)
        .map((t) => products.find((p) => p.id === t.productId)?.name)
        .filter(Boolean)
        .join(', '),
      segmentContext: segment
        ? `
        세그먼트: ${segment.segment_name} (${segment.segment_type})
        특성: ${JSON.stringify(segment.characteristics)}
        평균 주문액: ${segment.characteristics?.avg_order_value || 'N/A'}
        주문 빈도: ${segment.characteristics?.frequency || 'N/A'}
      `
        : '',
    };

    // AI 추천 요청
    const recommendations = await aiService.recommendMenus(context, menuList);

    // 추천 타입별 필터링 및 포맷팅
    return this._formatRecommendations(recommendations, products, type, limit, segment);
  }

  _formatPreferences(categoryPreference, preferences) {
    const parts = [];
    if (categoryPreference.length) {
      parts.push(
        `선호 카테고리: ${categoryPreference.map((c) => `${c.category}(${c.count}회)`).join(', ')}`
      );
    }
    if (preferences.favorite_categories?.length) {
      parts.push(`즐겨찾기: ${preferences.favorite_categories.join(', ')}`);
    }
    if (preferences.dietary_restrictions?.length) {
      parts.push(`식이 제한: ${preferences.dietary_restrictions.join(', ')} (절대 추천 금지)`);
    }
    if (preferences.spiciness) {
      parts.push(`맵기 선호도: ${preferences.spiciness}/3`);
    }
    return parts.join('; ') || '없음';
  }

  _getTimePeriod() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return '아침';
    if (hour >= 11 && hour < 15) return '점심';
    if (hour >= 15 && hour < 18) return '오후';
    if (hour >= 18 && hour < 22) return '저녁';
    return '야식';
  }

  /**
   * 추천 결과 포맷팅
   */
  _formatRecommendations(aiRecs, products, type, limit, segment) {
    const productMap = {};
    products.forEach((p) => {
      productMap[p.id] = p;
    });

    return aiRecs
      .filter((rec) => productMap[rec.id])
      .slice(0, limit)
      .map((rec, index) => {
        const product = productMap[rec.id];
        const baseRec = {
          store_id: product.store_id,
          recommendation_type: type,
          title: this._generateTitle(rec, product, type),
          description: rec.reason,
          target_product_ids: JSON.stringify([rec.id]),
          discount_percent: type === 'BUNDLE' ? 5 : segment?.characteristics?.discount || null,
          valid_from: new Date(),
          valid_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          click_through_rate: 0,
          conversion_rate: 0,
        };

        if (type === 'PERSONALIZED') {
          baseRec.customer_phone = segment ? null : 'segment_based';
          baseRec.segment_id = segment?.id || null;
        }

        return baseRec;
      });
  }

  _generateTitle(rec, product, type) {
    switch (type) {
      case 'PERSONALIZED':
        return `당신을 위한 ${product.name} 추천`;
      case 'BUNDLE':
        return `${product.name} 세트 할인`;
      case 'TRENDING':
        return `요즘 핫한 ${product.name}`;
      default:
        return `${product.name} 추천`;
    }
  }

  /**
   * 추천 결과 DB 저장
   */
  async _storeRecommendations(storeId, recommendations, segmentId, customerPhone) {
    const stored = [];
    for (const rec of recommendations) {
      try {
        const created = await prisma.ai_recommendations.create({
          data: {
            ...rec,
            store_id: storeId,
            segment_id: segmentId || rec.segment_id || null,
            customer_phone: customerPhone || rec.customer_phone || null,
          },
        });
        stored.push(created);
      } catch (error) {
        if (error.code !== 'P2002') {
          // 중복 키 에러 제외
          logger.warn({ error: error.message }, '추천 저장 실패 (건너뜀)');
        }
      }
    }
    return stored;
  }

  /**
   * 폴백 추천 (AI 실패 시)
   */
  async _getFallbackRecommendations(storeId, limit) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const topProducts = await prisma.order_items.groupBy({
      by: ['product_id'],
      where: {
        orders: {
          store_id: storeId,
          created_at: { gte: since },
          status: { not: 'cancelled' },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = topProducts.map((p) => p.product_id).filter(Boolean);
    const products = await prisma.products.findMany({
      where: { id: { in: productIds } },
    });

    return products.map((p, index) => ({
      store_id: storeId,
      recommendation_type: 'TRENDING',
      title: `인기 메뉴: ${p.name}`,
      description: `최근 30일간 가장 많이 주문된 메뉴입니다.`,
      target_product_ids: JSON.stringify([p.id]),
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }));
  }
}

module.exports = new RecommendationEngine();

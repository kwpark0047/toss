const { getRedisCache } = require('../utils/redisCache');
const logger = require('../utils/logger');

/**
 * 상위 레벨 캐시 서비스
 * AI 응답, 인기 상품, 매출 통계, 수요 예측 등 도메인 특화 캐싱 제공
 */
class CacheService {
  constructor() {
    this.cache = null;
    this.defaultTTL = {
      aiResponse: 3600, // 1시간 - AI 추천/설명
      forecast: 1800, // 30분 - 수요 예측
      popularProducts: 600, // 10분 - 인기 상품
      salesStats: 300, // 5분 - 매출 통계
      menuDescription: 86400, // 24시간 - 메뉴 설명
      customerSegment: 1800, // 30분 - 고객 세그먼트
      recommendation: 1800, // 30분 - 추천 결과
      storeInfo: 600, // 10분 - 매장 정보
    };
  }

  /**
   * 캐시 초기화
   */
  async init() {
    if (!this.cache) {
      this.cache = getRedisCache();
      await this.cache.connect();
    }
    return this.cache;
  }

  /**
   * 키 생성 헬퍼
   */
  buildKey(prefix, ...parts) {
    return `wemarket:${prefix}:${parts.join(':')}`;
  }

  // ============================================================
  // AI 응답 캐싱
  // ============================================================

  /**
   * AI 메뉴 추천 캐싱
   */
  async getCachedRecommendations(storeId, customerPhone, contextHash) {
    const key = this.buildKey(
      'ai',
      'recommendation',
      storeId,
      customerPhone || 'anonymous',
      contextHash
    );
    return this.cache.get(key);
  }

  async setCachedRecommendations(storeId, customerPhone, contextHash, recommendations) {
    const key = this.buildKey(
      'ai',
      'recommendation',
      storeId,
      customerPhone || 'anonymous',
      contextHash
    );
    return this.cache.setWithTags(key, recommendations, this.defaultTTL.aiResponse, [
      `store:${storeId}`,
      'ai:recommendation',
      customerPhone ? `customer:${customerPhone}` : 'customer:anonymous',
    ]);
  }

  /**
   * AI 메뉴 설명 캐싱
   */
  async getCachedMenuDescription(menuId, lang = 'ko') {
    const key = this.buildKey('ai', 'menu-description', menuId, lang);
    return this.cache.get(key);
  }

  async setCachedMenuDescription(menuId, lang, description) {
    const key = this.buildKey('ai', 'menu-description', menuId, lang);
    return this.cache.setWithTags(key, description, this.defaultTTL.menuDescription, [
      `menu:${menuId}`,
      'ai:menu-description',
    ]);
  }

  /**
   * AI 수요 예측 캐싱
   */
  async getCachedForecast(storeId, productId, horizonDays) {
    const key = this.buildKey('ai', 'forecast', storeId, productId, horizonDays);
    return this.cache.get(key);
  }

  async setCachedForecast(storeId, productId, horizonDays, forecast) {
    const key = this.buildKey('ai', 'forecast', storeId, productId, horizonDays);
    return this.cache.setWithTags(key, forecast, this.defaultTTL.forecast, [
      `store:${storeId}`,
      `product:${productId}`,
      'ai:forecast',
    ]);
  }

  /**
   * AI 고객 세그먼트 분석 캐싱
   */
  async getCachedCustomerSegment(storeId, customerPhone) {
    const key = this.buildKey('ai', 'segment', storeId, customerPhone);
    return this.cache.get(key);
  }

  async setCachedCustomerSegment(storeId, customerPhone, segment) {
    const key = this.buildKey('ai', 'segment', storeId, customerPhone);
    return this.cache.setWithTags(key, segment, this.defaultTTL.customerSegment, [
      `store:${storeId}`,
      `customer:${customerPhone}`,
      'ai:segment',
    ]);
  }

  // ============================================================
  // 인기 상품 캐싱
  // ============================================================

  /**
   * 인기 상품 조회 (기간별)
   */
  async getPopularProducts(storeId, period = '7d', limit = 10) {
    const key = this.buildKey('popular', 'products', storeId, period, limit);
    return this.cache.get(key);
  }

  async setPopularProducts(storeId, period, limit, products) {
    const key = this.buildKey('popular', 'products', storeId, period, limit);
    return this.cache.setWithTags(key, products, this.defaultTTL.popularProducts, [
      `store:${storeId}`,
      'popular:products',
    ]);
  }

  /**
   * 카테고리별 인기 상품
   */
  async getPopularProductsByCategory(storeId, categoryId, period = '7d', limit = 5) {
    const key = this.buildKey('popular', 'products', storeId, categoryId, period, limit);
    return this.cache.get(key);
  }

  async setPopularProductsByCategory(storeId, categoryId, period, limit, products) {
    const key = this.buildKey('popular', 'products', storeId, categoryId, period, limit);
    return this.cache.setWithTags(key, products, this.defaultTTL.popularProducts, [
      `store:${storeId}`,
      `category:${categoryId}`,
      'popular:products',
    ]);
  }

  // ============================================================
  // 매출 통계 캐싱
  // ============================================================

  /**
   * 매출 요약 통계 (실시간 대시보드용)
   */
  async getSalesSummary(storeId, period = 'today') {
    const key = this.buildKey('stats', 'sales-summary', storeId, period);
    return this.cache.get(key);
  }

  async setSalesSummary(storeId, period, summary) {
    const key = this.buildKey('stats', 'sales-summary', storeId, period);
    return this.cache.setWithTags(key, summary, this.defaultTTL.salesStats, [
      `store:${storeId}`,
      'stats:sales',
    ]);
  }

  /**
   * 결제 수단별 매출
   */
  async getPaymentMethodStats(storeId, startDate, endDate) {
    const key = this.buildKey('stats', 'payment-methods', storeId, startDate, endDate);
    return this.cache.get(key);
  }

  async setPaymentMethodStats(storeId, startDate, endDate, stats) {
    const key = this.buildKey('stats', 'payment-methods', storeId, startDate, endDate);
    return this.cache.setWithTags(key, stats, this.defaultTTL.salesStats, [
      `store:${storeId}`,
      'stats:payment-methods',
    ]);
  }

  /**
   * 시간대별 매출 트렌드
   */
  async getHourlySalesTrend(storeId, date) {
    const key = this.buildKey('stats', 'hourly-trend', storeId, date);
    return this.cache.get(key);
  }

  async setHourlySalesTrend(storeId, date, trend) {
    const key = this.buildKey('stats', 'hourly-trend', storeId, date);
    return this.cache.setWithTags(key, trend, this.defaultTTL.salesStats, [
      `store:${storeId}`,
      'stats:hourly',
    ]);
  }

  // ============================================================
  // 수요 예측 캐싱
  // ============================================================

  async getDemandForecast(storeId, productId, forecastDate) {
    const key = this.buildKey('forecast', 'demand', storeId, productId, forecastDate);
    return this.cache.get(key);
  }

  async setDemandForecast(storeId, productId, forecastDate, forecast) {
    const key = this.buildKey('forecast', 'demand', storeId, productId, forecastDate);
    return this.cache.setWithTags(key, forecast, this.defaultTTL.forecast, [
      `store:${storeId}`,
      `product:${productId}`,
      'forecast:demand',
    ]);
  }

  async getForecastAccuracy(storeId, productId, days = 30) {
    const key = this.buildKey('forecast', 'accuracy', storeId, productId, days);
    return this.cache.get(key);
  }

  async setForecastAccuracy(storeId, productId, days, accuracy) {
    const key = this.buildKey('forecast', 'accuracy', storeId, productId, days);
    return this.cache.setWithTags(key, accuracy, this.defaultTTL.forecast, [
      `store:${storeId}`,
      `product:${productId}`,
      'forecast:accuracy',
    ]);
  }

  // ============================================================
  // 매장 정보 캐싱
  // ============================================================

  async getStoreInfo(storeId) {
    const key = this.buildKey('store', 'info', storeId);
    return this.cache.get(key);
  }

  async setStoreInfo(storeId, info) {
    const key = this.buildKey('store', 'info', storeId);
    return this.cache.setWithTags(key, info, this.defaultTTL.storeInfo, [
      `store:${storeId}`,
      'store:info',
    ]);
  }

  async getStoreSettings(storeId) {
    const key = this.buildKey('store', 'settings', storeId);
    return this.cache.get(key);
  }

  async setStoreSettings(storeId, settings) {
    const key = this.buildKey('store', 'settings', storeId);
    return this.cache.setWithTags(key, settings, this.defaultTTL.storeInfo, [
      `store:${storeId}`,
      'store:settings',
    ]);
  }

  // ============================================================
  // 무효화 헬퍼
  // ============================================================

  /**
   * 매장 관련 모든 캐시 무효화
   */
  async invalidateStoreCache(storeId) {
    return this.cache.invalidateByTags([`store:${storeId}`]);
  }

  /**
   * AI 관련 캐시 무효화
   */
  async invalidateAICache(storeId) {
    return this.cache.invalidateByTags([
      `store:${storeId}`,
      'ai:recommendation',
      'ai:forecast',
      'ai:menu-description',
      'ai:segment',
    ]);
  }

  /**
   * 통계 관련 캐시 무효화
   */
  async invalidateStatsCache(storeId) {
    return this.cache.invalidateByTags([
      `store:${storeId}`,
      'stats:sales',
      'stats:payment-methods',
      'stats:hourly',
    ]);
  }

  /**
   * 인기 상품 캐시 무효화
   */
  async invalidatePopularProductsCache(storeId) {
    return this.cache.invalidateByTags([`store:${storeId}`, 'popular:products']);
  }

  /**
   * 예측 관련 캐시 무효화
   */
  async invalidateForecastCache(storeId, productId = null) {
    const tags = [`store:${storeId}`, 'forecast:demand', 'forecast:accuracy'];
    if (productId) tags.push(`product:${productId}`);
    return this.cache.invalidateByTags(tags);
  }

  /**
   * 헬스 체크
   */
  async healthCheck() {
    if (!this.cache) await this.init();
    return this.cache.healthCheck();
  }
}

// 싱글톤 인스턴스
let cacheServiceInstance = null;

/**
 * CacheService 싱글톤 가져오기
 */
async function getCacheService() {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
    await cacheServiceInstance.init();
  }
  return cacheServiceInstance;
}

module.exports = {
  CacheService,
  getCacheService,
};

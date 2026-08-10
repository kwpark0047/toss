const RecommendationTrackingRepository = require('../repositories/RecommendationTracking');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * 추천 성과 추적 서비스
 * - 노출/클릭/전환 기록
 * - 일일 통계 집계
 * - 퍼널 분석
 */
class RecommendationTrackingService {
  /**
   * 추천 노출 기록
   */
  async recordImpression(data) {
    try {
      const impression = await RecommendationTrackingRepository.recordImpression(data);

      // 일일 통계 업데이트
      await this.updateDailyStats(data.storeId, data.recommendationType, {
        impressions: 1,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      });

      return impression;
    } catch (error) {
      logger.error({ error: error.message, data }, 'Failed to record impression');
      throw error;
    }
  }

  /**
   * 추천 클릭 기록
   */
  async recordClick(data) {
    const { impressionId, ...rest } = data;

    try {
      // 노출 기록 조회
      const impression = await prisma.recommendation_impressions.findUnique({
        where: { id: impressionId },
      });

      if (!impression) {
        logger.warn({ impressionId }, 'Impression not found for click');
        return null;
      }

      const timeToClick = Date.now() - new Date(impression.created_at).getTime();

      const click = await RecommendationTrackingRepository.recordClick({
        ...rest,
        impressionId,
        timeToClickMs: timeToClick,
      });

      // 일일 통계 업데이트
      await this.updateDailyStats(data.storeId, data.recommendationType, {
        impressions: 0,
        clicks: 1,
        conversions: 0,
        revenue: 0,
      });

      return click;
    } catch (error) {
      logger.error({ error: error.message, data }, 'Failed to record click');
      throw error;
    }
  }

  /**
   * 추천 전환(주문) 기록
   */
  async recordConversion(data) {
    const { impressionId, clickId, orderId, ...rest } = data;

    try {
      // 주문 정보 조회
      const { Order } = require('../repositories/Order');
      const order = await Order.findById(orderId);

      if (!order) {
        logger.warn({ orderId }, 'Order not found for conversion');
        return null;
      }

      // 노출/클릭 시간 계산
      let timeToConversion = null;
      if (impressionId) {
        const impression = await prisma.recommendation_impressions.findUnique({
          where: { id: impressionId },
        });
        if (impression) {
          timeToConversion = Date.now() - new Date(impression.created_at).getTime();
        }
      } else if (clickId) {
        const click = await prisma.recommendation_clicks.findUnique({
          where: { id: clickId },
        });
        if (click) {
          timeToConversion = Date.now() - new Date(click.created_at).getTime();
        }
      }

      const conversion = await RecommendationTrackingRepository.recordConversion({
        ...rest,
        impressionId,
        clickId,
        orderId,
        conversionValue: order.total_amount || 0,
        timeToConversionMs: timeToConversion,
      });

      // 일일 통계 업데이트
      await this.updateDailyStats(rest.storeId, rest.recommendationType, {
        impressions: 0,
        clicks: 0,
        conversions: 1,
        revenue: order.total_amount || 0,
      });

      return conversion;
    } catch (error) {
      logger.error({ error: error.message, data }, 'Failed to record conversion');
      throw error;
    }
  }

  /**
   * 일일 통계 업데이트
   */
  async updateDailyStats(storeId, recommendationType, stats) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { impressions = 0, clicks = 0, conversions = 0, revenue = 0 } = stats;

    await RecommendationTrackingRepository.upsertDailyStats(storeId, today, recommendationType, {
      impressions,
      clicks,
      conversions,
      revenue,
    });
  }

  /**
   * 매장별 일일 통계 조회
   */
  async getDailyStats(storeId, startDate, endDate, recommendationType = null) {
    return await RecommendationTrackingRepository.getDailyStats(
      storeId,
      startDate,
      endDate,
      recommendationType
    );
  }

  /**
   * 매장별 종합 통계 요약
   */
  async getSummaryStats(storeId, startDate, endDate) {
    return await RecommendationTrackingRepository.getSummaryStats(storeId, startDate, endDate);
  }

  /**
   * 세션별 추천 퍼널 분석
   */
  async getSessionFunnel(storeId, sessionId) {
    return await RecommendationTrackingRepository.getSessionFunnel(storeId, sessionId);
  }

  /**
   * 추천 타입별 성과 비교
   */
  async getTypeComparison(storeId, startDate, endDate) {
    return await RecommendationTrackingRepository.getSummaryStats(storeId, startDate, endDate);
  }

  /**
   * 메뉴별 추천 성과
   */
  async getMenuPerformance(storeId, startDate, endDate) {
    const conversions = await prisma.recommendation_conversions.findMany({
      where: {
        store_id: storeId,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        menu_id: true,
        recommendation_type: true,
        conversion_value: true,
        quantity: true,
        attributed: true,
      },
    });

    // 메뉴별 집계
    const menuStats = {};
    for (const conv of conversions) {
      if (!conv.attributed) continue;

      const key = conv.menu_id;
      if (!menuStats[key]) {
        menuStats[key] = {
          menu_id: conv.menu_id,
          conversions: 0,
          revenue: 0,
          quantity: 0,
          by_type: {},
        };
      }
      menuStats[key].conversions++;
      menuStats[key].revenue += conv.conversion_value || 0;
      menuStats[key].quantity += conv.quantity || 1;

      if (!menuStats[key].by_type[conv.recommendation_type]) {
        menuStats[key].by_type[conv.recommendation_type] = 0;
      }
      menuStats[key].by_type[conv.recommendation_type]++;
    }

    // 메뉴 정보 조회
    const menuIds = Object.keys(menuStats).map(Number);
    const menus = await prisma.products.findMany({
      where: { id: { in: menuIds } },
      select: { id: true, name: true, price: true, image_url: true },
    });
    const menuMap = Object.fromEntries(menus.map((m) => [m.id, m]));

    return Object.entries(menuStats)
      .map(([id, stats]) => ({
        ...stats,
        menu: menuMap[parseInt(id)] || { name: 'Unknown' },
      }))
      .sort((a, b) => b.conversions - a.conversions);
  }

  /**
   * 시간대별 추천 성과
   */
  async getTimePeriodPerformance(storeId, startDate, endDate) {
    const impressions = await prisma.recommendation_impressions.findMany({
      where: {
        store_id: storeId,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        time_period: true,
        recommendation_type: true,
        created_at: true,
      },
    });

    const clicks = await prisma.recommendation_clicks.findMany({
      where: {
        store_id: storeId,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        impression_id: true,
      },
    });

    const conversions = await prisma.recommendation_conversions.findMany({
      where: {
        store_id: storeId,
        created_at: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        impression_id: true,
        conversion_value: true,
      },
    });

    const clickImpressions = new Set(clicks.map((c) => c.impression_id));
    const conversionImpressions = new Set(conversions.map((c) => c.impression_id));
    const revenueMap = new Map();
    conversions.forEach((c) => {
      revenueMap.set(
        c.impression_id,
        (revenueMap.get(c.impression_id) || 0) + (c.conversion_value || 0)
      );
    });

    const stats = {};
    for (const imp of impressions) {
      const key = imp.time_period || 'unknown';
      if (!stats[key]) {
        stats[key] = { impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      }
      stats[key].impressions++;
      if (clickImpressions.has(imp.id)) stats[key].clicks++;
      if (conversionImpressions.has(imp.id)) {
        stats[key].conversions++;
        stats[key].revenue += revenueMap.get(imp.id) || 0;
      }
    }

    return Object.entries(stats)
      .map(([period, stats]) => ({
        time_period: period,
        ...stats,
        ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
        cvr: stats.clicks > 0 ? stats.conversions / stats.clicks : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions);
  }
}

module.exports = new RecommendationTrackingService();

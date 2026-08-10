const prisma = require('../config/prisma');

/**
 * 추천 노출/클릭/전환 추적 리포지토리
 */
class RecommendationTrackingRepository {
  /**
   * 추천 노출 기록
   */
  async recordImpression(data) {
    const {
      storeId,
      sessionId,
      userId,
      phone,
      menuId,
      recommendationType,
      source,
      position,
      weatherContext,
      timePeriod,
    } = data;

    return await prisma.recommendation_impressions.create({
      data: {
        store_id: storeId,
        session_id: sessionId,
        user_id: userId,
        phone,
        menu_id: menuId,
        recommendation_type: recommendationType,
        source,
        position,
        weather_context: weatherContext,
        time_period: timePeriod,
      },
    });
  }

  /**
   * 추천 클릭 기록
   */
  async recordClick(data) {
    const {
      impressionId,
      storeId,
      sessionId,
      userId,
      phone,
      menuId,
      recommendationType,
      timeToClickMs,
    } = data;

    return await prisma.recommendation_clicks.create({
      data: {
        impression_id: impressionId,
        store_id: storeId,
        session_id: sessionId,
        user_id: userId,
        phone,
        menu_id: menuId,
        recommendation_type: recommendationType,
        time_to_click_ms: timeToClickMs,
      },
    });
  }

  /**
   * 추천 전환(주문) 기록
   */
  async recordConversion(data) {
    const {
      impressionId,
      clickId,
      storeId,
      sessionId,
      userId,
      phone,
      orderId,
      menuId,
      recommendationType,
      conversionValue,
      quantity,
      timeToConversionMs,
      attributed,
    } = data;

    return await prisma.recommendation_conversions.create({
      data: {
        impression_id: impressionId,
        click_id: clickId,
        store_id: storeId,
        session_id: sessionId,
        user_id: userId,
        phone,
        order_id: orderId,
        menu_id: menuId,
        recommendation_type: recommendationType,
        conversion_value: conversionValue,
        quantity: quantity || 1,
        time_to_conversion_ms: timeToConversionMs,
        attributed: attributed !== false,
      },
    });
  }

  /**
   * 세션별 노출 조회
   */
  async getImpressionsBySession(sessionId, storeId) {
    return await prisma.recommendation_impressions.findMany({
      where: {
        session_id: sessionId,
        store_id: storeId,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * 특정 노출에 대한 클릭 조회
   */
  async getClickByImpression(impressionId) {
    return await prisma.recommendation_clicks.findUnique({
      where: { impression_id: impressionId },
    });
  }

  /**
   * 특정 노출/클릭에 대한 전환 조회
   */
  async getConversionByImpression(impressionId) {
    return await prisma.recommendation_conversions.findFirst({
      where: { impression_id: impressionId },
    });
  }

  /**
   * 매장별 일일 통계 업데이트/생성 (Upsert)
   */
  async upsertDailyStats(storeId, date, recommendationType, stats) {
    const { impressions, clicks, conversions, revenue } = stats;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;
    const avgOrderValue = conversions > 0 ? revenue / conversions : 0;

    return await prisma.recommendation_daily_stats.upsert({
      where: {
        store_id_date_recommendation_type: {
          store_id: storeId,
          date: new Date(date),
          recommendation_type: recommendationType,
        },
      },
      update: {
        impressions: { increment: impressions },
        clicks: { increment: clicks },
        conversions: { increment: conversions },
        revenue: { increment: revenue },
        ctr: ctr,
        cvr: cvr,
        avg_order_value: avgOrderValue,
        updated_at: new Date(),
      },
      create: {
        store_id: storeId,
        date: new Date(date),
        recommendation_type: recommendationType,
        impressions,
        clicks,
        conversions,
        revenue,
        ctr,
        cvr,
        avg_order_value: avgOrderValue,
      },
    });
  }

  /**
   * 매장별 일일 통계 조회
   */
  async getDailyStats(storeId, startDate, endDate, recommendationType = null) {
    const where = {
      store_id: storeId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (recommendationType) {
      where.recommendation_type = recommendationType;
    }

    return await prisma.recommendation_daily_stats.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  /**
   * 매장별 추천 타입별 종합 통계
   */
  async getSummaryStats(storeId, startDate, endDate) {
    const stats = await prisma.recommendation_daily_stats.groupBy({
      by: ['recommendation_type'],
      where: {
        store_id: storeId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        revenue: true,
      },
    });

    return stats.map((s) => ({
      recommendation_type: s.recommendation_type,
      impressions: s._sum.impressions || 0,
      clicks: s._sum.clicks || 0,
      conversions: s._sum.conversions || 0,
      revenue: s._sum.revenue || 0,
      ctr: s._sum.impressions > 0 ? s._sum.clicks / s._sum.impressions : 0,
      cvr: s._sum.clicks > 0 ? s._sum.conversions / s._sum.clicks : 0,
    }));
  }

  /**
   * 세션별 추천 퍼널 분석
   */
  async getSessionFunnel(storeId, sessionId) {
    const impressions = await prisma.recommendation_impressions.findMany({
      where: { session_id: sessionId, store_id: storeId },
      orderBy: { created_at: 'asc' },
    });

    const impressionIds = impressions.map((i) => i.id);
    const clicks = await prisma.recommendation_clicks.findMany({
      where: { impression_id: { in: impressionIds } },
    });
    const conversions = await prisma.recommendation_conversions.findMany({
      where: { impression_id: { in: impressionIds } },
    });

    return {
      impressions: impressions.length,
      clicks: clicks.length,
      conversions: conversions.length,
      details: impressions.map((imp) => ({
        impression: imp,
        clicked: clicks.some((c) => c.impression_id === imp.id),
        converted: conversions.some((c) => c.impression_id === imp.id),
      })),
    };
  }
}

module.exports = new RecommendationTrackingRepository();

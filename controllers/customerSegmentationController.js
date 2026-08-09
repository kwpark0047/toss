const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * 고객 세그멘트 목록 조회
 */
async function getSegments(req, res) {
  try {
    const { storeId } = req.params;
    const { segmentType, isActive } = req.query;

    const where = { store_id: parseInt(storeId) };
    if (segmentType) where.segment_type = segmentType;
    if (isActive !== undefined) where.is_active = isActive === 'true';

    const segments = await prisma.customer_segments.findMany({
      where,
      orderBy: { size: 'desc' },
    });

    return res.json(segments);
  } catch (error) {
    logger.error({ error: error.message, storeId: req.params.storeId }, '세그멘트 조회 실패');
    return res.status(500).json({ error: '세그멘트 조회 실패' });
  }
}

/**
 * 세그멘트 생성/업데이트
 */
async function upsertSegment(req, res) {
  try {
    const { storeId } = req.params;
    const { id, segmentName, segmentType, description, characteristics } = req.body;

    if (id) {
      const segment = await prisma.customer_segments.update({
        where: { id, store_id: parseInt(storeId) },
        data: {
          segment_name: segmentName,
          segment_type: segmentType,
          segment_description: description,
          characteristics,
        },
      });
      return res.json(segment);
    }

    const segment = await prisma.customer_segments.create({
      data: {
        store_id: parseInt(storeId),
        segment_name: segmentName,
        segment_type: segmentType,
        segment_description: description,
        characteristics,
        size: 0,
        revenue_contribution: 0,
      },
    });

    return res.created(segment);
  } catch (error) {
    logger.error({ error: error.message, storeId: req.params.storeId }, '세그멘트 저장 실패');
    return res.status(500).json({ error: '세그멘트 저장 실패' });
  }
}

/**
 * 세그멘트 삭제
 */
async function deleteSegment(req, res) {
  try {
    const { storeId, segmentId } = req.params;

    await prisma.customer_segments.delete({
      where: { id: parseInt(segmentId), store_id: parseInt(storeId) },
    });

    return res.status(204).send();
  } catch (error) {
    logger.error({ error: error.message }, '세그멘트 삭제 실패');
    return res.status(500).json({ error: '세그멘트 삭제 실패' });
  }
}

/**
 * 고객 개인화 데이터 조회 (전화번호 기반)
 */
async function getPersonalization(req, res) {
  try {
    const { storeId } = req.params;
    const { customerPhone } = req.query;

    if (!customerPhone) {
      return res.status(400).json({ error: 'customerPhone 파라미터가 필요합니다' });
    }

    const personalization = await prisma.customer_personalizations.findUnique({
      where: {
        store_id_customer_phone: {
          store_id: parseInt(storeId),
          customer_phone: customerPhone,
        },
      },
      include: {
        segments: {
          select: { id: true, segment_name: true, segment_type: true, characteristics: true },
        },
      },
    });

    if (!personalization) {
      return res.status(404).json({ error: '개인화 데이터를 찾을 수 없습니다' });
    }

    return res.json(personalization);
  } catch (error) {
    logger.error({ error: error.message }, '개인화 데이터 조회 실패');
    return res.status(500).json({ error: '개인화 데이터 조회 실패' });
  }
}

/**
 * 고객 개인화 데이터 생성/업데이트
 */
async function upsertPersonalization(req, res) {
  try {
    const { storeId } = req.params;
    const { customerPhone, segmentId, preferences, customDiscount, specialOffers } = req.body;

    const personalization = await prisma.customer_personalizations.upsert({
      where: {
        store_id_customer_phone: {
          store_id: parseInt(storeId),
          customer_phone: customerPhone,
        },
      },
      update: {
        segment_id: segmentId || undefined,
        preferences: preferences || undefined,
        custom_discount: customDiscount,
        special_offers: specialOffers,
      },
      create: {
        store_id: parseInt(storeId),
        customer_phone: customerPhone,
        segment_id: segmentId || undefined,
        preferences: preferences || {},
        custom_discount: customDiscount || 0,
        special_offers: specialOffers || [],
      },
      include: {
        segments: {
          select: { id: true, segment_name: true, segment_type: true },
        },
      },
    });

    return res.json(personalization);
  } catch (error) {
    logger.error({ error: error.message }, '개인화 데이터 저장 실패');
    return res.status(500).json({ error: '개인화 데이터 저장 실패' });
  }
}

/**
 * AI 추천 목록 조회
 */
async function getRecommendations(req, res) {
  try {
    const { storeId } = req.params;
    const { customerPhone, recommendationType, segmentId } = req.query;

    const where = { store_id: parseInt(storeId) };
    if (customerPhone) where.customer_phone = customerPhone;
    if (recommendationType) where.recommendation_type = recommendationType;
    if (segmentId) where.segment_id = parseInt(segmentId);

    const recommendations = await prisma.ai_recommendations.findMany({
      where,
      include: {
        segments: { select: { id: true, segment_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json(recommendations);
  } catch (error) {
    logger.error({ error: error.message }, '추천 목록 조회 실패');
    return res.status(500).json({ error: '추천 목록 조회 실패' });
  }
}

/**
 * AI 추천 생성
 */
async function createRecommendation(req, res) {
  try {
    const { storeId } = req.params;
    const {
      customerPhone,
      segmentId,
      recommendationType,
      title,
      description,
      targetProductIds,
      discountPercent,
      validFrom,
      validTo,
    } = req.body;

    const recommendation = await prisma.ai_recommendations.create({
      data: {
        store_id: parseInt(storeId),
        customer_phone: customerPhone || null,
        segment_id: segmentId ? parseInt(segmentId) : null,
        recommendation_type: recommendationType,
        title,
        description,
        target_product_ids: targetProductIds || [],
        discount_percent: discountPercent,
        valid_from: validFrom ? new Date(validFrom) : new Date(),
        valid_to: validTo ? new Date(validTo) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info({ recommendationId: recommendation.id, storeId }, 'AI 추천 생성됨');
    return res.created(recommendation);
  } catch (error) {
    logger.error({ error: error.message }, 'AI 추천 생성 실패');
    return res.status(500).json({ error: 'AI 추천 생성 실패' });
  }
}

/**
 * 세그멘트 기반 AI 추천
 */
async function getRecommendationsBySegment(req, res) {
  try {
    const { storeId, segmentId } = req.params;

    const segment = await prisma.customer_segments.findUnique({
      where: { id: parseInt(segmentId), store_id: parseInt(storeId) },
    });

    if (!segment) {
      return res.status(404).json({ error: '세그멘트를 찾을 수 없습니다' });
    }

    const recommendations = await prisma.ai_recommendations.findMany({
      where: {
        store_id: parseInt(storeId),
        segment_id: parseInt(segmentId),
        valid_from: { lte: new Date() },
        valid_to: { gte: new Date() },
      },
      include: {
        segments: { select: { id: true, segment_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({ segment, recommendations });
  } catch (error) {
    logger.error({ error: error.message }, '세그멘트별 추천 조회 실패');
    return res.status(500).json({ error: '세그멘트별 추천 조회 실패' });
  }
}

/**
 * 세그멘트별 고객 목록
 */
async function getSegmentCustomers(req, res) {
  try {
    const { storeId, segmentId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const customers = await prisma.customer_personalizations.findMany({
      where: {
        store_id: parseInt(storeId),
        segment_id: parseInt(segmentId),
      },
      include: {
        segments: { select: { id: true, segment_name: true } },
      },
      orderBy: { lifetime_value: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.customer_personalizations.count({
      where: {
        store_id: parseInt(storeId),
        segment_id: parseInt(segmentId),
      },
    });

    return res.json({ items: customers, total });
  } catch (error) {
    logger.error({ error: error.message }, '세그멘트 고객 목록 조회 실패');
    return res.status(500).json({ error: '세그멘트 고객 목록 조회 실패' });
  }
}

/**
 * 개인화 분석 데이터
 */
async function getAnalytics(req, res) {
  try {
    const { storeId } = req.params;
    const { segmentId, days = 30 } = req.query;

    const where = { store_id: parseInt(storeId) };
    if (segmentId) where.segment_id = parseInt(segmentId);

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    where.date = { gte: since };

    const analytics = await prisma.personalization_analytics.findMany({
      where,
      orderBy: { date: 'desc' },
      take: parseInt(days),
    });

    // 집계 계산
    const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
    const totalClicks = analytics.reduce((sum, a) => sum + a.click_throughs, 0);
    const totalConversions = analytics.reduce((sum, a) => sum + a.conversions, 0);
    const totalRevenue = analytics.reduce((sum, a) => sum + a.revenue_from_segment, 0);

    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    const cvr = totalImpressions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(2) : 0;
    const aov = totalConversions > 0 ? Math.round(totalRevenue / totalConversions) : 0;

    return res.json({
      items: analytics,
      summary: { totalImpressions, totalClicks, totalConversions, totalRevenue, ctr, cvr, aov },
    });
  } catch (error) {
    logger.error({ error: error.message }, '개인화 분석 조회 실패');
    return res.status(500).json({ error: '개인화 분석 조회 실패' });
  }
}

module.exports = {
  getSegments,
  upsertSegment,
  deleteSegment,
  getPersonalization,
  upsertPersonalization,
  getRecommendations,
  createRecommendation,
  getRecommendationsBySegment,
  getSegmentCustomers,
  getAnalytics,
};

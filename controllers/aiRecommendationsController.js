const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

async function generateProductRecommendations(storeId) {
  const since = new Date(Date.now() - 30 * 86400000);

  const orderItems = await prisma.order_items.findMany({
    where: {
      orders: {
        store_id: Number(storeId),
        created_at: { gte: since },
        status: { not: 'cancelled' },
      },
    },
    select: { order_id: true, product_id: true, product_name: true },
  });

  if (orderItems.length < 10) return [];

  const productCount = {};
  const productOrders = {};
  for (const item of orderItems) {
    if (item.product_id) {
      productCount[item.product_id] = (productCount[item.product_id] || 0) + 1;
      if (!productOrders[item.product_id]) productOrders[item.product_id] = new Set();
      productOrders[item.product_id].add(item.order_id);
    }
  }

  const productIds = Object.keys(productCount).map(Number);
  const topProducts = productIds
    .map((id) => ({ id, count: productCount[id], orders: productOrders[id].size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topProductIds = topProducts.map((p) => p.id);
  const coOccurrence = {};
  for (let i = 0; i < topProductIds.length; i++) {
    for (let j = i + 1; j < topProductIds.length; j++) {
      const a = topProductIds[i],
        b = topProductIds[j];
      const shared = [...(productOrders[a] || [])].filter((o) =>
        (productOrders[b] || []).has(o)
      ).length;
      if (shared >= 2) {
        coOccurrence[`${a}-${b}`] = shared;
      }
    }
  }

  const productDetails = await prisma.products.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true },
  });
  const detailMap = {};
  for (const p of productDetails) detailMap[p.id] = p;

  const recommendations = [];
  for (const p of topProducts) {
    const detail = detailMap[p.id];
    recommendations.push({
      store_id: Number(storeId),
      recommendation_type: 'PRODUCT',
      title: `${detail?.name || '인기 상품'} 추천`,
      description: `최근 30일간 ${p.count}회 주문된 인기 메뉴입니다.`,
      target_product_ids: JSON.stringify([p.id]),
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 7 * 86400000),
    });
  }

  const seen = new Set();
  for (const [key, shared] of Object.entries(coOccurrence)) {
    const [a, b] = key.split('-').map(Number);
    const da = detailMap[a],
      db = detailMap[b];
    if (!da || !db || seen.has(`${b}-${a}`)) continue;
    seen.add(key);
    recommendations.push({
      store_id: Number(storeId),
      recommendation_type: 'BUNDLE',
      title: `${da.name} + ${db.name} 세트`,
      description: `함께 주문이 많은 인기 조합 (${shared}회).`,
      target_product_ids: JSON.stringify([a, b]),
      discount_percent: 5,
      valid_from: new Date(),
      valid_to: new Date(Date.now() + 7 * 86400000),
    });
  }

  return recommendations;
}

const aiRecommendationsController = {
  getRecommendations: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { segmentId, recommendationType, limit = 10 } = req.query;

      const where = { store_id: Number(storeId) };
      if (segmentId) where.segment_id = Number(segmentId);
      if (recommendationType) where.recommendation_type = recommendationType;

      const now = new Date();
      const recommendations = await prisma.ai_recommendations.findMany({
        where: { ...where, valid_from: { lte: now }, valid_to: { gte: now } },
        orderBy: { created_at: 'desc' },
        take: Number(limit),
      });

      res.success(recommendations, '추천 목록 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  createRecommendations: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const {
        customer_phone,
        segment_id,
        recommendation_type,
        title,
        description,
        target_product_ids,
        discount_percent,
        valid_from,
        valid_to,
      } = req.body;

      const recommendation = await prisma.ai_recommendations.create({
        data: {
          store_id: Number(storeId),
          customer_phone: customer_phone || null,
          segment_id: segment_id ? Number(segment_id) : null,
          recommendation_type: recommendation_type || 'PRODUCT',
          title,
          description,
          target_product_ids: JSON.stringify(target_product_ids || []),
          discount_percent: discount_percent || null,
          valid_from: valid_from ? new Date(valid_from) : new Date(),
          valid_to: valid_to ? new Date(valid_to) : new Date(Date.now() + 30 * 86400000),
        },
      });

      res.success(recommendation, '추천 생성 완료', 201);
    } catch (err) {
      next(err);
    }
  },

  getRecommendationById: async (req, res, next) => {
    try {
      const { storeId, id } = req.params;
      const recommendation = await prisma.ai_recommendations.findFirst({
        where: { id: Number(id), store_id: Number(storeId) },
      });
      if (!recommendation) throw new AppError('추천을 찾을 수 없습니다.', 404);
      res.success(recommendation, '추천 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  updateRecommendation: async (req, res, next) => {
    try {
      const { storeId, id } = req.params;
      const updates = req.body;
      const data = {};
      for (const key of [
        'customer_phone',
        'segment_id',
        'recommendation_type',
        'title',
        'description',
        'target_product_ids',
        'discount_percent',
        'valid_from',
        'valid_to',
        'click_through_rate',
        'conversion_rate',
      ]) {
        if (updates[key] !== undefined) data[key] = updates[key];
      }
      if (data.target_product_ids && typeof data.target_product_ids !== 'string') {
        data.target_product_ids = JSON.stringify(data.target_product_ids);
      }
      const recommendation = await prisma.ai_recommendations.update({
        where: { id: Number(id), store_id: Number(storeId) },
        data,
      });
      res.success(recommendation, '추천 수정 완료');
    } catch (err) {
      next(err);
    }
  },

  deleteRecommendation: async (req, res, next) => {
    try {
      const { storeId, id } = req.params;
      await prisma.ai_recommendations.delete({
        where: { id: Number(id), store_id: Number(storeId) },
      });
      res.success(null, '추천 삭제 완료');
    } catch (err) {
      next(err);
    }
  },

  getCustomerSegments: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const segments = await prisma.customer_segments.findMany({
        where: { store_id: Number(storeId), is_active: true },
        orderBy: { created_at: 'desc' },
      });
      res.success(segments, '고객 세그먼트 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  createCustomerSegment: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const {
        segment_name,
        segment_type,
        segment_description,
        characteristics,
        size,
        revenue_contribution,
      } = req.body;

      if (!segment_name || !segment_type) {
        throw new AppError('segment_name과 segment_type은 필수입니다.', 400);
      }

      const segment = await prisma.customer_segments.create({
        data: {
          store_id: Number(storeId),
          segment_name,
          segment_type,
          segment_description,
          characteristics,
          size,
          revenue_contribution,
          is_active: true,
        },
      });

      res.success(segment, '세그먼트 생성 완료', 201);
    } catch (err) {
      next(err);
    }
  },

  getCustomerPersonalizations: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { segmentId } = req.query;
      const where = { store_id: Number(storeId) };
      if (segmentId) where.segment_id = Number(segmentId);

      const personalizations = await prisma.customer_personalizations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      res.success(personalizations, '고객 개인화 설정 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  getCustomerPersonalization: async (req, res, next) => {
    try {
      const { storeId, customerPhone } = req.params;
      const personalization = await prisma.customer_personalizations.findFirst({
        where: {
          store_id: Number(storeId),
          customer_phone: customerPhone.replace(/[^0-9]/g, ''),
        },
        include: { segments: true },
      });
      if (!personalization) throw new AppError('고객 개인화 설정을 찾을 수 없습니다.', 404);
      res.success(personalization, '고객 개인화 설정 조회 완료');
    } catch (err) {
      next(err);
    }
  },

  updateCustomerPersonalization: async (req, res, next) => {
    try {
      const { storeId, customerPhone } = req.params;
      const { preferences, custom_discount, special_offers, segment_id } = req.body;

      const normalizedPhone = customerPhone.replace(/[^0-9]/g, '');

      const personalization = await prisma.customer_personalizations.upsert({
        where: {
          store_customer_phone: {
            store_id: Number(storeId),
            customer_phone: normalizedPhone,
          },
        },
        create: {
          store_id: Number(storeId),
          customer_phone: normalizedPhone,
          preferences,
          custom_discount,
          special_offers,
          segment_id: segment_id ? Number(segment_id) : null,
        },
        update: {
          preferences: preferences !== undefined ? preferences : undefined,
          custom_discount: custom_discount !== undefined ? custom_discount : undefined,
          special_offers: special_offers !== undefined ? special_offers : undefined,
          segment_id: segment_id !== undefined ? Number(segment_id) : undefined,
        },
      });

      res.success(personalization, '고객 개인화 설정 업데이트 완료');
    } catch (err) {
      next(err);
    }
  },

  generateRecommendations: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const recommendations = await generateProductRecommendations(storeId);

      let created = 0;
      for (const rec of recommendations) {
        await prisma.ai_recommendations.create({ data: rec });
        created++;
      }

      res.success({ generated: created, recommendations }, 'AI 추천 생성 완료');
    } catch (err) {
      next(err);
    }
  },

  getPersonalizationAnalytics: async (req, res, next) => {
    try {
      const { storeId } = req.params;
      const { segmentId, days = 30 } = req.query;
      const since = new Date(Date.now() - Number(days) * 86400000);

      const where = { store_id: Number(storeId), date: { gte: since } };
      if (segmentId) where.segment_id = Number(segmentId);

      const analytics = await prisma.personalization_analytics.findMany({
        where,
        orderBy: { date: 'desc' },
      });

      res.success(analytics, '개인화 분석 조회 완료');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = aiRecommendationsController;

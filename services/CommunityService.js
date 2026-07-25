const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

/**
 * [CommunityService]
 * 지역 커뮤니티 피드 및 매장 제휴 관련 비즈니스 로직을 처리합니다.
 */
class CommunityService {
  /**
   * 주소에서 지역(시/도 + 구/군)을 추출합니다.
   */
  extractDistrict(address) {
    if (!address) return null;
    const parts = address.split(/[\s,]+/);
    const siDo = parts.find(p =>
      (p.includes('서울') || p.includes('부산') || p.includes('대구') || p.includes('인천') ||
       p.includes('광주') || p.includes('대전') || p.includes('울산') || p.includes('세종') ||
       (p.endsWith('시') && p.length >= 3) || (p.endsWith('도') && p.length >= 2)) &&
      !p.endsWith('동') && !p.endsWith('시장') && !p.endsWith('아파트')
    );
    const gu = parts.find(p => (p.endsWith('구') || p.endsWith('군')) && p.length >= 3);
    if (siDo && gu) return `${siDo} ${gu}`;
    if (gu) return gu;
    return parts.slice(0, 2).join(' ') || null;
  }

  /**
   * 지역 피드를 조회합니다.
   */
  async getFeed({ district, type, page = 1, limit = 20, storeId }) {
    let targetDistrict = district;
    if (!targetDistrict && storeId) {
      const store = await prisma.stores.findUnique({
        where: { id: parseInt(storeId) }, select: { address: true },
      });
      targetDistrict = this.extractDistrict(store?.address);
    }

    const where = {
      is_active: true,
      OR: [{ expires_at: null }, { expires_at: { gte: new Date() } }],
    };
    if (targetDistrict) {
      const guName = targetDistrict.split(' ').pop();
      if (guName) where.district = { contains: guName };
    }
    if (type && type !== 'ALL') where.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      prisma.community_posts.findMany({
        where,
        include: { stores: { select: { id: true, name: true, business_type: true, address: true } } },
        orderBy: { created_at: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.community_posts.count({ where }),
    ]);

    return { posts, total, district: targetDistrict, page: parseInt(page) };
  }

  /**
   * 내 매장의 피드 목록을 조회합니다.
   */
  async getMyPosts(userId, storeId) {
    const userStores = await prisma.stores.findMany({
      where: { user_id: userId }, select: { id: true },
    });
    const ownedIds = new Set(userStores.map(s => s.id));
    if (storeId && !ownedIds.has(parseInt(storeId))) {
      throw Object.assign(new Error('권한 없음'), { statusCode: 403 });
    }
    const storeIds = storeId ? [parseInt(storeId)] : [...ownedIds];

    return prisma.community_posts.findMany({
      where: { store_id: { in: storeIds }, is_active: true },
      include: { stores: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * 피드를 작성합니다.
   */
  async createPost(storeId, userId, { type, title, content, expires_at }) {
    if (!storeId || !title?.trim() || !content?.trim()) {
      throw Object.assign(new Error('매장, 제목, 내용은 필수입니다.'), { statusCode: 400 });
    }

    const store = await prisma.stores.findFirst({
      where: { id: parseInt(storeId), user_id: userId },
    });
    if (!store) {
      throw Object.assign(new Error('매장 접근 권한이 없습니다.'), { statusCode: 403 });
    }

    const district = this.extractDistrict(store.address);
    return prisma.community_posts.create({
      data: {
        store_id: parseInt(storeId),
        type: type || 'NEWS',
        title: title.trim(),
        content: content.trim(),
        district,
        expires_at: expires_at ? new Date(expires_at) : null,
      },
      include: { stores: { select: { id: true, name: true } } },
    });
  }

  /**
   * 피드를 수정합니다.
   */
  async updatePost(id, userId, data) {
    const post = await prisma.community_posts.findFirst({
      where: { id }, include: { stores: { select: { user_id: true } } },
    });
    if (!post) {
      throw Object.assign(new Error('피드를 찾을 수 없습니다.'), { statusCode: 404 });
    }
    if (post.stores.user_id !== userId) {
      throw Object.assign(new Error('수정 권한이 없습니다.'), { statusCode: 403 });
    }

    const { type, title, content, expires_at } = data;
    return prisma.community_posts.update({
      where: { id },
      data: {
        ...(type    && { type }),
        ...(title   && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        expires_at: expires_at !== undefined
          ? (expires_at ? new Date(expires_at) : null)
          : post.expires_at,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 피드를 삭제합니다 (soft delete).
   */
  async deletePost(id, userId) {
    const post = await prisma.community_posts.findFirst({
      where: { id }, include: { stores: { select: { user_id: true } } },
    });
    if (!post) {
      throw Object.assign(new Error('피드를 찾을 수 없습니다.'), { statusCode: 404 });
    }
    if (post.stores.user_id !== userId) {
      throw Object.assign(new Error('삭제 권한이 없습니다.'), { statusCode: 403 });
    }

    await prisma.community_posts.update({ where: { id }, data: { is_active: false } });
  }

  /**
   * 좋아요를 토글합니다.
   */
  async toggleLike(postId, userId) {
    const existing = await prisma.community_post_likes.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: userId } },
    });

    if (existing) {
      await prisma.community_post_likes.delete({
        where: { post_id_user_id: { post_id: postId, user_id: userId } },
      });
      await prisma.community_posts.update({
        where: { id: postId }, data: { like_count: { decrement: 1 } },
      });
      return { liked: false };
    }

    await prisma.community_post_likes.create({ data: { post_id: postId, user_id: userId } });
    await prisma.community_posts.update({
      where: { id: postId }, data: { like_count: { increment: 1 } },
    });
    return { liked: true };
  }

  /**
   * 주변 매장을 조회합니다.
   */
  async getNearbyStores({ storeId, district }) {
    let targetDistrict = district;
    if (!targetDistrict && storeId) {
      const store = await prisma.stores.findUnique({
        where: { id: parseInt(storeId) }, select: { address: true },
      });
      targetDistrict = this.extractDistrict(store?.address);
    }
    if (!targetDistrict) return { district: null, stores: [] };

    const guName = targetDistrict.split(' ').pop();
    const stores = await prisma.stores.findMany({
      where: {
        is_active: true,
        address: { contains: guName },
        ...(storeId ? { id: { not: parseInt(storeId) } } : {}),
      },
      select: {
        id: true, name: true, business_type: true,
        address: true, phone: true, open_time: true, close_time: true,
      },
      take: 40,
      orderBy: { name: 'asc' },
    });

    return { district: targetDistrict, stores };
  }

  /**
   * 내 제휴 현황을 조회합니다.
   */
  async getPartnerships(storeId, userId) {
    const myStore = await prisma.stores.findFirst({
      where: { id: parseInt(storeId), user_id: userId },
    });
    if (!myStore) {
      throw Object.assign(new Error('권한 없음'), { statusCode: 403 });
    }

    const sid = parseInt(storeId);
    const [sent, received] = await Promise.all([
      prisma.store_partnerships.findMany({
        where: { requester_id: sid },
        include: { target_store: { select: { id: true, name: true, business_type: true, address: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.store_partnerships.findMany({
        where: { target_id: sid },
        include: { requester_store: { select: { id: true, name: true, business_type: true, address: true } } },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { sent, received };
  }

  /**
   * 제휴를 신청합니다.
   */
  async createPartnership(storeId, targetStoreId, userId, message) {
    if (!storeId || !targetStoreId) {
      throw Object.assign(new Error('매장 ID와 대상 매장 ID가 필요합니다'), { statusCode: 400 });
    }

    const myStore = await prisma.stores.findFirst({
      where: { id: parseInt(storeId), user_id: userId },
    });
    if (!myStore) {
      throw Object.assign(new Error('권한 없음'), { statusCode: 403 });
    }
    if (parseInt(storeId) === parseInt(targetStoreId)) {
      throw Object.assign(new Error('자기 매장에는 신청할 수 없습니다.'), { statusCode: 400 });
    }

    const existing = await prisma.store_partnerships.findUnique({
      where: { requester_id_target_id: { requester_id: parseInt(storeId), target_id: parseInt(targetStoreId) } },
    });
    if (existing) {
      throw Object.assign(new Error('이미 신청한 제휴입니다.'), { statusCode: 409 });
    }

    return prisma.store_partnerships.create({
      data: {
        requester_id: parseInt(storeId),
        target_id: parseInt(targetStoreId),
        message: message?.trim() || null,
      },
    });
  }

  /**
   * 제휴 요청에 응답(승인/거절)합니다.
   */
  async respondToPartnership(id, userId, action) {
    const partnership = await prisma.store_partnerships.findUnique({
      where: { id },
      include: {
        target_store:    { select: { id: true, name: true, user_id: true } },
        requester_store: { select: { id: true, name: true } },
      },
    });
    if (!partnership) {
      throw Object.assign(new Error('제휴 신청을 찾을 수 없습니다.'), { statusCode: 404 });
    }
    if (partnership.target_store.user_id !== userId) {
      throw Object.assign(new Error('권한 없음'), { statusCode: 403 });
    }

    const status = action === 'accept' ? 'accepted' : 'rejected';
    const updated = await prisma.store_partnerships.update({
      where: { id }, data: { status, updated_at: new Date() },
    });

    // 제휴 수락 → 양쪽 매장에 공동 쿠폰 자동 발급
    if (action === 'accept') {
      await this._issuePartnershipCoupons(partnership);
    }

    return {
      partnership: updated,
      message: action === 'accept'
        ? '제휴가 수락되고 공동 쿠폰이 발급되었습니다.'
        : '제휴 거절됐습니다.',
    };
  }

  /**
   * 제휴 수락 시 양쪽 매장에 공동 쿠폰을 발급합니다.
   */
  async _issuePartnershipCoupons(partnership) {
    const pairs = [
      { store: partnership.requester_store, partner: partnership.target_store },
      { store: partnership.target_store,    partner: partnership.requester_store },
    ];

    for (const { store, partner } of pairs) {
      try {
        const couponName = `🤝 제휴 할인 · ${partner.name}`;
        const exists = await prisma.coupons.findFirst({
          where: { store_id: store.id, name: couponName, is_active: 1 },
        });
        if (!exists) {
          await prisma.coupons.create({
            data: {
              store_id: store.id,
              name: couponName,
              type: 'percent',
              amount: 10,
              min_order_amount: 10000,
              valid_days: 30,
              is_active: 1,
            },
          });
        }
        await notificationService.createNotification({
          store_id: store.id,
          type: 'PARTNERSHIP',
          title: '🤝 제휴 성사 & 공동 쿠폰 발급',
          message: `${partner.name}와(과)의 제휴가 성사됐습니다. "제휴 할인 10%" 쿠폰이 자동 발급되었습니다. (최소 주문 10,000원 · 30일 유효)`,
          data: { partnership_id: partnership.id, partner_store_id: partner.id, partner_name: partner.name },
          priority: 'high',
          link: `/admin/stores/${store.id}/coupons`,
        });
      } catch (err) {
        logger.warn(`[제휴쿠폰] store ${store.id} 발급 실패: ${err.message}`);
      }
    }
  }
}

module.exports = new CommunityService();

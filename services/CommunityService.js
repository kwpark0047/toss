const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const { AppError } = require('../utils/errorHandler');

const ALLOWED_POST_TYPES = new Set(['EVENT', 'PROMOTION', 'NEWS', 'PRODUCT']);
const MAX_FEED_LIMIT = 50;

const parsePositiveInt = (value, fieldName, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName}는 양의 정수여야 합니다.`, 400);
  }
  return parsed;
};

const parseDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} 형식이 올바르지 않습니다.`, 400);
  }
  return parsed;
};

const validatePostType = (type) => {
  if (type !== undefined && !ALLOWED_POST_TYPES.has(type)) {
    throw new AppError('유효하지 않은 피드 유형입니다.', 400);
  }
};

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
    const siDo = parts.find(
      (p) =>
        (p.includes('서울') ||
          p.includes('부산') ||
          p.includes('대구') ||
          p.includes('인천') ||
          p.includes('광주') ||
          p.includes('대전') ||
          p.includes('울산') ||
          p.includes('세종') ||
          (p.endsWith('시') && p.length >= 3) ||
          (p.endsWith('도') && p.length >= 2)) &&
        !p.endsWith('동') &&
        !p.endsWith('시장') &&
        !p.endsWith('아파트')
    );
    const gu = parts.find((p) => (p.endsWith('구') || p.endsWith('군')) && p.length >= 3);
    if (siDo && gu) return `${siDo} ${gu}`;
    if (gu) return gu;
    return parts.slice(0, 2).join(' ') || null;
  }

  /**
   * 지역 피드를 조회합니다.
   */
  async getFeed({ district, type, page = 1, limit = 20, storeId }) {
    const pageNumber = parsePositiveInt(page, '페이지', 1);
    const limitNumber = Math.min(parsePositiveInt(limit, '페이지 크기', 20), MAX_FEED_LIMIT);
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    let targetDistrict = district;
    if (!targetDistrict && storeNumber) {
      const store = await prisma.stores.findUnique({
        where: { id: storeNumber },
        select: { address: true },
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
    if (type && type !== 'ALL') {
      validatePostType(type);
      where.type = type;
    }

    const skip = (pageNumber - 1) * limitNumber;
    const [posts, total] = await Promise.all([
      prisma.community_posts.findMany({
        where,
        include: {
          stores: { select: { id: true, name: true, business_type: true, address: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.community_posts.count({ where }),
    ]);

    return { posts, total, district: targetDistrict, page: pageNumber, limit: limitNumber };
  }

  /**
   * 내 매장의 피드 목록을 조회합니다.
   */
  async getMyPosts(userId, storeId) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const userStores = await prisma.stores.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const ownedIds = new Set(userStores.map((s) => s.id));
    if (storeNumber && !ownedIds.has(storeNumber)) {
      throw new AppError('권한 없음', 403);
    }
    const storeIds = storeNumber ? [storeNumber] : [...ownedIds];

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
      throw new AppError('매장, 제목, 내용은 필수입니다.', 400);
    }
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    validatePostType(type);
    const expiresAt = expires_at ? parseDate(expires_at, '만료일') : null;

    const store = await prisma.stores.findFirst({
      where: { id: storeNumber, user_id: userId },
    });
    if (!store) {
      throw new AppError('매장 접근 권한이 없습니다.', 403);
    }

    const district = this.extractDistrict(store.address);
    return prisma.community_posts.create({
      data: {
        store_id: storeNumber,
        type: type || 'NEWS',
        title: title.trim(),
        content: content.trim(),
        district,
        expires_at: expiresAt,
      },
      include: { stores: { select: { id: true, name: true } } },
    });
  }

  /**
   * 피드를 수정합니다.
   */
  async updatePost(id, userId, data) {
    const postId = parsePositiveInt(id, '피드 ID');
    const post = await prisma.community_posts.findFirst({
      where: { id: postId },
      include: { stores: { select: { user_id: true } } },
    });
    if (!post) {
      throw new AppError('피드를 찾을 수 없습니다.', 404);
    }
    if (post.stores.user_id !== userId) {
      throw new AppError('수정 권한이 없습니다.', 403);
    }

    const { type, title, content, expires_at } = data;
    validatePostType(type);
    return prisma.community_posts.update({
      where: { id: postId },
      data: {
        ...(type && { type }),
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        expires_at:
          expires_at !== undefined
            ? expires_at
              ? parseDate(expires_at, '만료일')
              : null
            : post.expires_at,
        updated_at: new Date(),
      },
    });
  }

  /**
   * 피드를 삭제합니다 (soft delete).
   */
  async deletePost(id, userId) {
    const postId = parsePositiveInt(id, '피드 ID');
    const post = await prisma.community_posts.findFirst({
      where: { id: postId },
      include: { stores: { select: { user_id: true } } },
    });
    if (!post) {
      throw new AppError('피드를 찾을 수 없습니다.', 404);
    }
    if (post.stores.user_id !== userId) {
      throw new AppError('삭제 권한이 없습니다.', 403);
    }

    await prisma.community_posts.update({ where: { id: postId }, data: { is_active: false } });
  }

  /**
   * 좋아요를 토글합니다.
   */
  async toggleLike(postId, userId) {
    const postNumber = parsePositiveInt(postId, '피드 ID');
    const post = await prisma.community_posts.findUnique({
      where: { id: postNumber },
      select: { id: true, is_active: true },
    });
    if (!post || !post.is_active) {
      throw new AppError('피드를 찾을 수 없습니다.', 404);
    }

    const existing = await prisma.community_post_likes.findUnique({
      where: { post_id_user_id: { post_id: postNumber, user_id: userId } },
    });

    if (existing) {
      await prisma.community_post_likes.delete({
        where: { post_id_user_id: { post_id: postNumber, user_id: userId } },
      });
      await prisma.community_posts.update({
        where: { id: postNumber },
        data: { like_count: { decrement: 1 } },
      });
      return { liked: false };
    }

    await prisma.community_post_likes.create({ data: { post_id: postNumber, user_id: userId } });
    await prisma.community_posts.update({
      where: { id: postNumber },
      data: { like_count: { increment: 1 } },
    });
    return { liked: true };
  }

  /**
   * 주변 매장을 조회합니다.
   */
  async getNearbyStores({ storeId, district }) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    let targetDistrict = district;
    if (!targetDistrict && storeNumber) {
      const store = await prisma.stores.findUnique({
        where: { id: storeNumber },
        select: { address: true },
      });
      targetDistrict = this.extractDistrict(store?.address);
    }
    if (!targetDistrict) return { district: null, stores: [] };

    const guName = targetDistrict.split(' ').pop();
    const stores = await prisma.stores.findMany({
      where: {
        is_active: true,
        address: { contains: guName },
        ...(storeNumber ? { id: { not: storeNumber } } : {}),
      },
      select: {
        id: true,
        name: true,
        business_type: true,
        address: true,
        phone: true,
        open_time: true,
        close_time: true,
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
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const myStore = await prisma.stores.findFirst({
      where: { id: storeNumber, user_id: userId },
    });
    if (!myStore) {
      throw new AppError('권한 없음', 403);
    }

    const sid = storeNumber;
    const [sent, received] = await Promise.all([
      prisma.store_partnerships.findMany({
        where: { requester_id: sid },
        include: {
          target_store: { select: { id: true, name: true, business_type: true, address: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.store_partnerships.findMany({
        where: { target_id: sid },
        include: {
          requester_store: { select: { id: true, name: true, business_type: true, address: true } },
        },
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
      throw new AppError('매장 ID와 대상 매장 ID가 필요합니다', 400);
    }
    const requesterId = parsePositiveInt(storeId, '매장 ID');
    const targetId = parsePositiveInt(targetStoreId, '대상 매장 ID');

    const myStore = await prisma.stores.findFirst({
      where: { id: requesterId, user_id: userId },
    });
    if (!myStore) {
      throw new AppError('권한 없음', 403);
    }
    if (requesterId === targetId) {
      throw new AppError('자기 매장에는 신청할 수 없습니다.', 400);
    }

    const targetStore = await prisma.stores.findUnique({
      where: { id: targetId },
      select: { id: true, is_active: true },
    });
    if (!targetStore || !targetStore.is_active) {
      throw new AppError('대상 매장을 찾을 수 없습니다.', 404);
    }

    const existing = await prisma.store_partnerships.findUnique({
      where: { requester_id_target_id: { requester_id: requesterId, target_id: targetId } },
    });
    if (existing) {
      throw new AppError('이미 신청한 제휴입니다.', 409);
    }

    return prisma.store_partnerships.create({
      data: {
        requester_id: requesterId,
        target_id: targetId,
        message: message?.trim() || null,
      },
    });
  }

  /**
   * 제휴 요청에 응답(승인/거절)합니다.
   */
  async respondToPartnership(id, userId, action) {
    const partnershipId = parsePositiveInt(id, '제휴 ID');
    if (action !== 'accept' && action !== 'reject') {
      throw new AppError('action은 accept 또는 reject여야 합니다.', 400);
    }
    const partnership = await prisma.store_partnerships.findUnique({
      where: { id: partnershipId },
      include: {
        target_store: { select: { id: true, name: true, user_id: true } },
        requester_store: { select: { id: true, name: true } },
      },
    });
    if (!partnership) {
      throw new AppError('제휴 신청을 찾을 수 없습니다.', 404);
    }
    if (partnership.target_store.user_id !== userId) {
      throw new AppError('권한 없음', 403);
    }

    const status = action === 'accept' ? 'accepted' : 'rejected';
    const updated = await prisma.store_partnerships.update({
      where: { id: partnershipId },
      data: { status, updated_at: new Date() },
    });

    // 제휴 수락 → 양쪽 매장에 공동 쿠폰 자동 발급
    if (action === 'accept') {
      await this._issuePartnershipCoupons(partnership);
    }

    return {
      partnership: updated,
      message:
        action === 'accept' ? '제휴가 수락되고 공동 쿠폰이 발급되었습니다.' : '제휴 거절됐습니다.',
    };
  }

  /**
   * 제휴 수락 시 양쪽 매장에 공동 쿠폰을 발급합니다.
   */
  async _issuePartnershipCoupons(partnership) {
    const pairs = [
      { store: partnership.requester_store, partner: partnership.target_store },
      { store: partnership.target_store, partner: partnership.requester_store },
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
          data: {
            partnership_id: partnership.id,
            partner_store_id: partner.id,
            partner_name: partner.name,
          },
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

const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

// 주소 → 지역(구/군) 추출
function extractDistrict(address) {
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

// ── [1] 지역 피드 조회 (공개) ──────────────────────────────────────
router.get('/feed', catchAsync(async (req, res) => {
  const { district, type, page = 1, limit = 20, store_id } = req.query;

  let targetDistrict = district;
  if (!targetDistrict && store_id) {
    const store = await prisma.stores.findUnique({
      where: { id: parseInt(store_id) }, select: { address: true },
    });
    targetDistrict = extractDistrict(store?.address);
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

  res.success({ posts, total, district: targetDistrict, page: parseInt(page) });
}));

// ── [2] 내 매장 피드 목록 (인증) ───────────────────────────────────
router.get('/my-posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  const userStores = await prisma.stores.findMany({
    where: { user_id: req.user.id }, select: { id: true },
  });
  const ownedIds = new Set(userStores.map(s => s.id));
  if (store_id && !ownedIds.has(parseInt(store_id))) {
    return res.status(403).json({ success: false, error: '권한 없음' });
  }
  const storeIds = store_id
    ? [parseInt(store_id)]
    : [...ownedIds];

  const posts = await prisma.community_posts.findMany({
    where: { store_id: { in: storeIds }, is_active: true },
    include: { stores: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.success(posts);
}));

// ── [3] 피드 작성 (인증) ──────────────────────────────────────────
router.post('/posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, type, title, content, expires_at } = req.body;
  if (!store_id || !title?.trim() || !content?.trim()) {
    return res.status(400).json({ success: false, error: '매장, 제목, 내용은 필수입니다.' });
  }

  const store = await prisma.stores.findFirst({
    where: { id: parseInt(store_id), user_id: req.user.id },
  });
  if (!store) return res.status(403).json({ success: false, error: '매장 접근 권한이 없습니다.' });

  const district = extractDistrict(store.address);
  const post = await prisma.community_posts.create({
    data: {
      store_id: parseInt(store_id),
      type: type || 'NEWS',
      title: title.trim(),
      content: content.trim(),
      district,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
    include: { stores: { select: { id: true, name: true } } },
  });
  res.success(post, '피드가 게시되었습니다.', 201);
}));

// ── [4] 피드 수정 (인증) ──────────────────────────────────────────
router.put('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const post = await prisma.community_posts.findFirst({
    where: { id }, include: { stores: { select: { user_id: true } } },
  });
  if (!post) return res.status(404).json({ success: false, error: '피드를 찾을 수 없습니다.' });
  if (post.stores.user_id !== req.user.id)
    return res.status(403).json({ success: false, error: '수정 권한이 없습니다.' });

  const { type, title, content, expires_at } = req.body;
  const updated = await prisma.community_posts.update({
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
  res.success(updated, '수정되었습니다.');
}));

// ── [5] 피드 삭제 (인증) ──────────────────────────────────────────
router.delete('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const post = await prisma.community_posts.findFirst({
    where: { id }, include: { stores: { select: { user_id: true } } },
  });
  if (!post) return res.status(404).json({ success: false, error: '피드를 찾을 수 없습니다.' });
  if (post.stores.user_id !== req.user.id)
    return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });

  await prisma.community_posts.update({ where: { id }, data: { is_active: false } });
  res.success(null, '삭제되었습니다.');
}));

// ── [6] 좋아요 토글 ───────────────────────────────────────────────
router.post('/posts/:id/like', optionalAuth, catchAsync(async (req, res) => {
  const post_id = parseInt(req.params.id);
  const user_id = req.user?.id || null;

  if (!user_id) {
    await prisma.community_posts.update({
      where: { id: post_id }, data: { like_count: { increment: 1 } },
    });
    return res.success({ liked: true });
  }

  const existing = await prisma.community_post_likes.findUnique({
    where: { post_id_user_id: { post_id, user_id } },
  });

  if (existing) {
    await prisma.community_post_likes.delete({
      where: { post_id_user_id: { post_id, user_id } },
    });
    await prisma.community_posts.update({
      where: { id: post_id }, data: { like_count: { decrement: 1 } },
    });
    return res.success({ liked: false });
  }

  await prisma.community_post_likes.create({ data: { post_id, user_id } });
  await prisma.community_posts.update({
    where: { id: post_id }, data: { like_count: { increment: 1 } },
  });
  return res.success({ liked: true });
}));

// ── [7] 주변 매장 조회 ────────────────────────────────────────────
router.get('/nearby', catchAsync(async (req, res) => {
  const { store_id, district } = req.query;

  let targetDistrict = district;
  if (!targetDistrict && store_id) {
    const store = await prisma.stores.findUnique({
      where: { id: parseInt(store_id) }, select: { address: true },
    });
    targetDistrict = extractDistrict(store?.address);
  }
  if (!targetDistrict) return res.success({ district: null, stores: [] });

  const guName = targetDistrict.split(' ').pop();
  const stores = await prisma.stores.findMany({
    where: {
      is_active: true,
      address: { contains: guName },
      ...(store_id ? { id: { not: parseInt(store_id) } } : {}),
    },
    select: {
      id: true, name: true, business_type: true,
      address: true, phone: true, open_time: true, close_time: true,
    },
    take: 40,
    orderBy: { name: 'asc' },
  });

  res.success({ district: targetDistrict, stores });
}));

// ── [8] 내 제휴 현황 (인증) ──────────────────────────────────────
router.get('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ success: false, error: 'store_id 필요' });

  const myStore = await prisma.stores.findFirst({
    where: { id: parseInt(store_id), user_id: req.user.id },
  });
  if (!myStore) return res.status(403).json({ success: false, error: '권한 없음' });

  const sid = parseInt(store_id);
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

  res.success({ sent, received });
}));

// ── [9] 제휴 신청 (인증) ─────────────────────────────────────────
router.post('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, target_store_id, message } = req.body;
  if (!store_id || !target_store_id)
    return res.status(400).json({ success: false, error: 'store_id, target_store_id 필요' });

  const myStore = await prisma.stores.findFirst({
    where: { id: parseInt(store_id), user_id: req.user.id },
  });
  if (!myStore) return res.status(403).json({ success: false, error: '권한 없음' });
  if (parseInt(store_id) === parseInt(target_store_id))
    return res.status(400).json({ success: false, error: '자기 매장에는 신청할 수 없습니다.' });

  const existing = await prisma.store_partnerships.findUnique({
    where: { requester_id_target_id: { requester_id: parseInt(store_id), target_id: parseInt(target_store_id) } },
  });
  if (existing) return res.status(409).json({ success: false, error: '이미 신청한 제휴입니다.' });

  const partnership = await prisma.store_partnerships.create({
    data: {
      requester_id: parseInt(store_id),
      target_id: parseInt(target_store_id),
      message: message?.trim() || null,
    },
  });
  res.success(partnership, '제휴 신청이 완료됐습니다.', 201);
}));

// ── [10] 제휴 승인/거절 (인증) ────────────────────────────────────
router.put('/partnerships/:id/respond', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const { action } = req.body; // accept | reject

  const partnership = await prisma.store_partnerships.findUnique({
    where: { id },
    include: { target_store: { select: { user_id: true } } },
  });
  if (!partnership) return res.status(404).json({ success: false, error: '제휴 신청을 찾을 수 없습니다.' });
  if (partnership.target_store.user_id !== req.user.id)
    return res.status(403).json({ success: false, error: '권한 없음' });

  const status = action === 'accept' ? 'accepted' : 'rejected';
  const updated = await prisma.store_partnerships.update({
    where: { id }, data: { status, updated_at: new Date() },
  });
  res.success(updated, action === 'accept' ? '제휴 수락됐습니다.' : '제휴 거절됐습니다.');
}));

module.exports = router;

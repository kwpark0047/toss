const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const communityService = require('../services/CommunityService');

// ── [1] 지역 피드 조회 (공개) ──────────────────────────────────────
router.get('/feed', catchAsync(async (req, res) => {
  const { district, type, page, limit, store_id: storeId } = req.query;
  const result = await communityService.getFeed({ district, type, page, limit, storeId });
  res.success(result);
}));

// ── [2] 내 매장 피드 목록 (인증) ───────────────────────────────────
router.get('/my-posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  const posts = await communityService.getMyPosts(req.user.id, store_id);
  res.success(posts);
}));

// ── [3] 피드 작성 (인증) ──────────────────────────────────────────
router.post('/posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, type, title, content, expires_at } = req.body;
  const post = await communityService.createPost(store_id, req.user.id, { type, title, content, expires_at });
  res.success(post, '피드가 게시되었습니다.', 201);
}));

// ── [4] 피드 수정 (인증) ──────────────────────────────────────────
router.put('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const updated = await communityService.updatePost(id, req.user.id, req.body);
  res.success(updated, '수정되었습니다.');
}));

// ── [5] 피드 삭제 (인증) ──────────────────────────────────────────
router.delete('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  await communityService.deletePost(id, req.user.id);
  res.success(null, '삭제되었습니다.');
}));

// ── [6] 좋아요 토글 (인증) ─────────────────────────────────────────
router.post('/posts/:id/like', authMiddleware, catchAsync(async (req, res) => {
  const postId = parseInt(req.params.id);
  const result = await communityService.toggleLike(postId, req.user.id);
  res.success(result);
}));

// ── [7] 주변 매장 조회 ────────────────────────────────────────────
router.get('/nearby', catchAsync(async (req, res) => {
  const { store_id: storeId, district } = req.query;
  const result = await communityService.getNearbyStores({ storeId, district });
  res.success(result);
}));

// ── [8] 내 제휴 현황 (인증) ──────────────────────────────────────
router.get('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ success: false, error: '매장 ID가 필요합니다' });
  const result = await communityService.getPartnerships(store_id, req.user.id);
  res.success(result);
}));

// ── [9] 제휴 신청 (인증) ─────────────────────────────────────────
router.post('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, target_store_id, message } = req.body;
  const partnership = await communityService.createPartnership(store_id, target_store_id, req.user.id, message);
  res.success(partnership, '제휴 신청이 완료됐습니다.', 201);
}));

// ── [10] 제휴 승인/거절 (인증) ────────────────────────────────────
router.put('/partnerships/:id/respond', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const { action } = req.body;
  const result = await communityService.respondToPartnership(id, req.user.id, action);
  res.success(result.partnership, result.message);
}));

module.exports = router;

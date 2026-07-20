const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const communityService = require('../services/CommunityService');

/**
 * @swagger
 * tags:
 *   name: Community
 *   description: 지역 커뮤니티 및 제휴 API
 */

/**
 * @swagger
 * /api/community/feed:
 *   get:
 *     tags: [Community]
 *     summary: 지역 피드 조회 (공개)
 *     parameters:
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 피드 목록 반환
 */
router.get('/feed', catchAsync(async (req, res) => {
  const { district, type, page, limit, store_id: storeId } = req.query;
  const result = await communityService.getFeed({ district, type, page, limit, storeId });
  res.success(result);
}));

/**
 * @swagger
 * /api/community/my-posts:
 *   get:
 *     tags: [Community]
 *     summary: 내 매장 피드 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 내 피드 목록 반환
 */
router.get('/my-posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  const posts = await communityService.getMyPosts(req.user.id, store_id);
  res.success(posts);
}));

/**
 * @swagger
 * /api/community/posts:
 *   post:
 *     tags: [Community]
 *     summary: 피드 작성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, type, title, content]
 *             properties:
 *               store_id:
 *                 type: integer
 *               type:
 *                 type: string
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: 피드 게시 완료
 */
router.post('/posts', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, type, title, content, expires_at } = req.body;
  const post = await communityService.createPost(store_id, req.user.id, { type, title, content, expires_at });
  res.success(post, '피드가 게시되었습니다.', 201);
}));

/**
 * @swagger
 * /api/community/posts/{id}:
 *   put:
 *     tags: [Community]
 *     summary: 피드 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: 피드 수정 완료
 */
router.put('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const updated = await communityService.updatePost(id, req.user.id, req.body);
  res.success(updated, '수정되었습니다.');
}));

/**
 * @swagger
 * /api/community/posts/{id}:
 *   delete:
 *     tags: [Community]
 *     summary: 피드 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 피드 삭제 완료
 */
router.delete('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  await communityService.deletePost(id, req.user.id);
  res.success(null, '삭제되었습니다.');
}));

/**
 * @swagger
 * /api/community/posts/{id}/like:
 *   post:
 *     tags: [Community]
 *     summary: 좋아요 토글
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 좋아요 상태 반환
 */
router.post('/posts/:id/like', authMiddleware, catchAsync(async (req, res) => {
  const postId = parseInt(req.params.id);
  const result = await communityService.toggleLike(postId, req.user.id);
  res.success(result);
}));

/**
 * @swagger
 * /api/community/nearby:
 *   get:
 *     tags: [Community]
 *     summary: 주변 매장 조회
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 주변 매장 목록 반환
 */
router.get('/nearby', catchAsync(async (req, res) => {
  const { store_id: storeId, district } = req.query;
  const result = await communityService.getNearbyStores({ storeId, district });
  res.success(result);
}));

/**
 * @swagger
 * /api/community/partnerships:
 *   get:
 *     tags: [Community]
 *     summary: 내 제휴 현황 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 제휴 현황 반환
 */
router.get('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ success: false, error: '매장 ID가 필요합니다.' });
  const result = await communityService.getPartnerships(store_id, req.user.id);
  res.success(result);
}));

/**
 * @swagger
 * /api/community/partnerships:
 *   post:
 *     tags: [Community]
 *     summary: 제휴 요청
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, target_store_id]
 *             properties:
 *               store_id:
 *                 type: integer
 *               target_store_id:
 *                 type: integer
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: 제휴 요청 완료
 */
router.post('/partnerships', authMiddleware, catchAsync(async (req, res) => {
  const { store_id, target_store_id, message } = req.body;
  const partnership = await communityService.createPartnership(store_id, target_store_id, req.user.id, message);
  res.success(partnership, '제휴 요청이 완료되었습니다.', 201);
}));

/**
 * @swagger
 * /api/community/partnerships/{id}/respond:
 *   put:
 *     tags: [Community]
 *     summary: 제휴 승인/거절
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: 제휴 처리 결과
 */
router.put('/partnerships/:id/respond', authMiddleware, catchAsync(async (req, res) => {
  const id = parseInt(req.params.id);
  const { action } = req.body;
  const result = await communityService.respondToPartnership(id, req.user.id, action);
  res.success(result.partnership, result.message);
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const reviewsController = require('../controllers/reviewsController');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: 리뷰 관리 API
 */

/**
 * @swagger
 * /api/reviews/store/{storeId}:
 *   get:
 *     tags: [Reviews]
 *     summary: 매장별 리뷰 목록 조회 (최신순)
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 리뷰 목록
 */
router.get('/store/:storeId', reviewsController.getStoreReviews);

/**
 * @swagger
 * /api/reviews/feed:
 *   get:
 *     tags: [Reviews]
 *     summary: 전체 매장 최신 리뷰 피드
 *     responses:
 *       200:
 *         description: 리뷰 피드 목록
 */
router.get('/feed', reviewsController.getFeed);

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: 리뷰 등록
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeId, rating]
 *             properties:
 *               storeId:
 *                 type: integer
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 리뷰 등록 완료
 */
router.post('/', reviewsController.createReview);

/**
 * @swagger
 * /api/reviews/{id}/like:
 *   post:
 *     tags: [Reviews]
 *     summary: 리뷰 좋아요 토글
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 좋아요 토글 결과
 */
router.post('/:id/like', reviewsController.toggleLike);

/**
 * @swagger
 * /api/reviews/{id}/ai-reply:
 *   post:
 *     tags: [Reviews]
 *     summary: AI 리뷰 초안 생성 (매장 관리자용)
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
 *         description: AI 생성 답변 초안
 */
router.post('/:id/ai-reply', authMiddleware, reviewsController.generateAiReply);

/**
 * @swagger
 * /api/reviews/{id}/reply:
 *   put:
 *     tags: [Reviews]
 *     summary: 리플라이 등록/수정
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: 리플라이 등록/수정 완료
 */
router.put('/:id/reply', authMiddleware, reviewsController.setReply);

/**
 * @swagger
 * /api/reviews/{id}/reply:
 *   delete:
 *     tags: [Reviews]
 *     summary: 리플라이 삭제
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
 *         description: 리플라이 삭제 완료
 */
router.delete('/:id/reply', authMiddleware, reviewsController.deleteReply);

/**
 * @swagger
 * /api/reviews/store/{storeId}/sentiment:
 *   get:
 *     tags: [Reviews]
 *     summary: 매장 리뷰 감정 분석 요약 (AI)
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 감정 분석 요약 (긍정/부정/보통 + 키워드)
 */
router.get('/store/:storeId/sentiment', reviewsController.getStoreSentimentSummary);

/**
 * @swagger
 * /api/reviews/{id}/sentiment:
 *   get:
 *     tags: [Reviews]
 *     summary: 단일 리뷰 AI 감정 분석
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
 *         description: 감정 분석 결과 (sentiment, score, keywords, summary)
 */
router.get('/:id/sentiment', authMiddleware, reviewsController.analyzeSentiment);

module.exports = router;

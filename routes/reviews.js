const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const reviewsController = require('../controllers/reviewsController');

// [GET] 매장별 리뷰 목록 조회 (최신순)
router.get('/store/:storeId', reviewsController.getStoreReviews);

// [GET] 리뷰 피드 (전체 매장 최신 리뷰)
router.get('/feed', reviewsController.getFeed);

// [POST] 리뷰 등록
router.post('/', reviewsController.createReview);

// [POST] 리뷰 좋아요 토글
router.post('/:id/like', reviewsController.toggleLike);

// [POST] AI 리뷰 초안 생성
router.post('/:id/ai-reply', authMiddleware, reviewsController.generateAiReply);

// [PUT] 리플라이 등록/수정
router.put('/:id/reply', authMiddleware, reviewsController.setReply);

// [DELETE] 리플라이 삭제
router.delete('/:id/reply', authMiddleware, reviewsController.deleteReply);

module.exports = router;

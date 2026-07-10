const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// 게시글 단일 상세 조회
router.get('/posts/:id', optionalAuth, boardController.getPostById);

// 게시글 수정
router.put('/posts/:id', authMiddleware, boardController.updatePost);

// 게시글 삭제
router.delete('/posts/:id', authMiddleware, boardController.deletePost);

// 게시글 상단 고정 토글
router.put('/posts/:id/pin', authMiddleware, boardController.togglePin);

// 게시글 좋아요 토글
router.post('/posts/:id/like', authMiddleware, boardController.toggleLike);

// 특정 게시글의 댓글 목록 조회
router.get('/posts/:id/comments', optionalAuth, boardController.getComments);

// 댓글 등록
router.post('/posts/:id/comments', authMiddleware, boardController.createComment);

// 댓글 삭제
router.delete('/comments/:id', authMiddleware, boardController.deleteComment);

// 인기 게시글 목록 조회
router.get('/trending', optionalAuth, boardController.getTrendingPosts);

// 게시글 목록 조회 (게시판 타입별)
router.get('/:type', optionalAuth, boardController.getPosts);

// 게시글 등록
router.post('/:type', authMiddleware, boardController.createPost);

module.exports = router;

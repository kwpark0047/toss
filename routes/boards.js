const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Boards
 *   description: 게시판 API (게시글, 댓글, 좋아요)
 */

/**
 * @swagger
 * /api/boards/posts/{id}:
 *   get:
 *     tags: [Boards]
 *     summary: 게시글 단일 상세 조회
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
 *         description: 게시글 상세 반환
 */
router.get('/posts/:id', optionalAuth, boardController.getPostById);

/**
 * @swagger
 * /api/boards/posts/{id}:
 *   put:
 *     tags: [Boards]
 *     summary: 게시글 수정
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
 *         description: 게시글 수정 완료
 */
router.put('/posts/:id', authMiddleware, boardController.updatePost);

/**
 * @swagger
 * /api/boards/posts/{id}:
 *   delete:
 *     tags: [Boards]
 *     summary: 게시글 삭제
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
 *         description: 게시글 삭제 완료
 */
router.delete('/posts/:id', authMiddleware, boardController.deletePost);

/**
 * @swagger
 * /api/boards/posts/{id}/pin:
 *   put:
 *     tags: [Boards]
 *     summary: 게시글 상단 고정 토글
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
 *         description: 고정 상태 토글 완료
 */
router.put('/posts/:id/pin', authMiddleware, boardController.togglePin);

/**
 * @swagger
 * /api/boards/posts/{id}/like:
 *   post:
 *     tags: [Boards]
 *     summary: 게시글 좋아요 토글
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
 *         description: 좋아요 토글 완료
 */
router.post('/posts/:id/like', authMiddleware, boardController.toggleLike);

/**
 * @swagger
 * /api/boards/posts/{id}/comments:
 *   get:
 *     tags: [Boards]
 *     summary: 게시글 댓글 목록 조회
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
 *         description: 댓글 목록 반환
 */
router.get('/posts/:id/comments', optionalAuth, boardController.getComments);

/**
 * @swagger
 * /api/boards/posts/{id}/comments:
 *   post:
 *     tags: [Boards]
 *     summary: 댓글 등록
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
 *         description: 댓글 등록 완료
 */
router.post('/posts/:id/comments', authMiddleware, boardController.createComment);

/**
 * @swagger
 * /api/boards/comments/{id}:
 *   delete:
 *     tags: [Boards]
 *     summary: 댓글 삭제
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
 *         description: 댓글 삭제 완료
 */
router.delete('/comments/:id', authMiddleware, boardController.deleteComment);

/**
 * @swagger
 * /api/boards/trending:
 *   get:
 *     tags: [Boards]
 *     summary: 인기 게시글 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 인기 게시글 목록 반환
 */
router.get('/trending', optionalAuth, boardController.getTrendingPosts);

/**
 * @swagger
 * /api/boards/{type}:
 *   get:
 *     tags: [Boards]
 *     summary: 게시글 목록 조회 (게시판 타입별)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: 게시판 타입 (notice, free, qna 등)
 *     responses:
 *       200:
 *         description: 게시글 목록 반환
 */
router.get('/:type', optionalAuth, boardController.getPosts);

/**
 * @swagger
 * /api/boards/{type}:
 *   post:
 *     tags: [Boards]
 *     summary: 게시글 등록
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: 게시글 등록 완료
 */
router.post('/:type', authMiddleware, boardController.createPost);

module.exports = router;

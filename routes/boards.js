const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { Post, Comment } = require('../models/Board');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');

/**
 * 게시판(Board) API 라우트 (Prisma 비동기 기반)
 */

// 관리자 역할 확인 헬퍼
const isAdmin = (user) => ['super_admin', 'store_admin'].includes(user?.role);

// [GET] /api/boards/:type - 게시글 목록 조회
router.get('/:type', optionalAuth, catchAsync(async (req, res) => {
    const { type } = req.params;
    const validTypes = ['notice', 'free', 'faq', 'qna'];

        if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, error: '유효하지 않은 게시판 타입입니다.' });
    }

    const { page = 1, limit = 10, search = '', searchType = 'title' } = req.query;
    const result = await Post.findAll(type, {
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    searchType,
    });

    return res.json({ success: true, data: result });
}));

// [GET] /api/boards/posts/:id - 게시글 상세 조회
router.get('/posts/:id', optionalAuth, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
        if (isNaN(id)) {
    return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });
    }
    const post = await Post.findById(id);
        if (!post) {
    return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
    }

    // 조회수 증가 (비동기로 백그라운드 처리)
    Post.incrementView(id).catch(e => logger.error(e));

    // 수동 데이터 동기화 (응답에는 반영)
    post.view_count += 1;

    return res.json({ success: true, data: post });
}));

// [POST] /api/boards/:type - 게시글 작성
router.post('/:type', authMiddleware, catchAsync(async (req, res) => {
    const { type } = req.params;
        if (!['notice', 'free', 'faq', 'qna'].includes(type)) {
    return res.status(400).json({ success: false, error: '유효하지 않은 타입입니다.' });
    }

    // 공지사항(notice) 및 자주 묻는 질문(faq)은 관리자만 작성 가능
        if (['notice', 'faq'].includes(type) && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '해당 게시판은 관리자만 작성 가능합니다.' });
    }

    const { title, content, is_pinned = false } = req.body;
        if (!title || !content) {
    return res.status(400).json({ success: false, error: '제목과 내용을 모두 입력해주세요.' });
    }

    const post = await Post.create({
    board_type: type,
    title,
    content,
    author_id: req.user.id,
    author_name: req.user.name,
    is_pinned: isAdmin(req.user) ? is_pinned : false,
    });

    return res.status(201).json({ success: true, data: post, message: '등록되었습니다.' });
}));

// [PUT] /api/boards/posts/:id - 게시글 수정
router.put('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

        if (post.author_id !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '수정 권한이 없습니다.' });
    }

    const { title, content, is_pinned } = req.body;
    const updated = await Post.update(id, {
    title,
    content,
    is_pinned: isAdmin(req.user) ? is_pinned : undefined,
    });

    return res.json({ success: true, data: updated, message: '수정되었습니다.' });
}));

// [DELETE] /api/boards/posts/:id - 게시글 삭제
router.delete('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

        if (post.author_id !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    await Post.delete(id);
    return res.json({ success: true, message: '삭제되었습니다.' });
}));

// [PUT] /api/boards/posts/:id/pin - 고정글 토글
router.put('/posts/:id/pin', authMiddleware, catchAsync(async (req, res) => {
        if (!isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '권한이 없습니다.' });
    }

    const post = await Post.togglePin(parseInt(req.params.id));
        if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

    return res.json({ success: true, data: post, message: post.is_pinned ? '고정되었습니다.' : '해제되었습니다.' });
}));

// [GET] /api/boards/posts/:id/comments - 댓글 조회
router.get('/posts/:id/comments', optionalAuth, catchAsync(async (req, res) => {
    const comments = await Comment.findByPostId(parseInt(req.params.id));
    return res.json({ success: true, data: comments });
}));

// [POST] /api/boards/posts/:id/comments - 댓글 작성
router.post('/posts/:id/comments', authMiddleware, catchAsync(async (req, res) => {
    const post_id = parseInt(req.params.id);
    const { content, parent_id = null } = req.body;

        if (!content?.trim()) {
    return res.status(400).json({ success: false, error: '내용을 입력해주세요.' });
    }

    const comment = await Comment.create({
    post_id,
    parent_id: parent_id ? parseInt(parent_id) : null,
    content: content.trim(),
    author_id: req.user.id,
    author_name: req.user.name,
    });

    return res.status(201).json({ success: true, data: comment, message: '등록되었습니다.' });
}));

// [DELETE] /api/boards/comments/:id - 댓글 삭제
router.delete('/comments/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const comment = await Comment.findById(id);
        if (!comment) return res.status(404).json({ success: false, error: '댓글이 없습니다.' });

        if (comment.author_id !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    await Comment.delete(id);
    return res.json({ success: true, message: '삭제되었습니다.' });
}));

module.exports = router;

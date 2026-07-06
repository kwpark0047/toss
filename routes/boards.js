const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');

const isAdmin = (user) => ['super_admin', 'store_admin'].includes(user?.role);

// ── 게시글 CRUD (specific routes first, before /:type wildcard) ─────────────

// [GET] /posts/:id
router.get('/posts/:id', optionalAuth, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '유효하지 않은 게시글 ID입니다.' });

    const post = await prisma.posts.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });

    prisma.posts.update({ where: { id }, data: { view_count: { increment: 1 } } }).catch(e => logger.error(e));
    post.view_count = (post.view_count || 0) + 1;

    let is_liked = false;
    if (req.user) {
        const like = await prisma.post_likes.findUnique({
            where: { post_id_user_id: { post_id: id, user_id: req.user.id } }
        });
        is_liked = !!like;
    }

    return res.json({ success: true, data: { ...post, is_liked } });
}));

// [PUT] /posts/:id
router.put('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const post = await prisma.posts.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });
    if (post.author_id !== req.user.id && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '수정 권한이 없습니다.' });
    }

    const { title, content, is_pinned, tags } = req.body;
    const normalizedTags = tags != null
        ? tags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean).slice(0, 5).join(',')
        : post.tags;

    const updated = await prisma.posts.update({
        where: { id },
        data: {
            ...(title && { title: title.trim() }),
            ...(content && { content: content.trim() }),
            ...(isAdmin(req.user) && is_pinned !== undefined && { is_pinned }),
            tags: normalizedTags,
            updated_at: new Date(),
        }
    });

    return res.json({ success: true, data: updated, message: '수정되었습니다.' });
}));

// [DELETE] /posts/:id
router.delete('/posts/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const post = await prisma.posts.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });
    if (post.author_id !== req.user.id && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    await prisma.posts.delete({ where: { id } });
    return res.json({ success: true, message: '삭제되었습니다.' });
}));

// [PUT] /posts/:id/pin
router.put('/posts/:id/pin', authMiddleware, catchAsync(async (req, res) => {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const id = parseInt(req.params.id);
    const post = await prisma.posts.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ success: false, error: '게시글이 없습니다.' });

    const updated = await prisma.posts.update({
        where: { id },
        data: { is_pinned: !post.is_pinned }
    });
    return res.json({ success: true, data: updated, message: updated.is_pinned ? '고정되었습니다.' : '해제되었습니다.' });
}));

// [POST] /posts/:id/like
router.post('/posts/:id/like', authMiddleware, catchAsync(async (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await prisma.post_likes.findUnique({
        where: { post_id_user_id: { post_id: postId, user_id: userId } }
    });

    let liked;
    if (existing) {
        await prisma.post_likes.delete({ where: { post_id_user_id: { post_id: postId, user_id: userId } } });
        await prisma.posts.update({ where: { id: postId }, data: { like_count: { decrement: 1 } } });
        liked = false;
    } else {
        await prisma.post_likes.create({ data: { post_id: postId, user_id: userId } });
        await prisma.posts.update({ where: { id: postId }, data: { like_count: { increment: 1 } } });
        liked = true;
    }

    const post = await prisma.posts.findUnique({ where: { id: postId }, select: { like_count: true } });
    return res.json({ success: true, data: { liked, like_count: post.like_count } });
}));

// [GET] /posts/:id/comments
router.get('/posts/:id/comments', optionalAuth, catchAsync(async (req, res) => {
    const postId = parseInt(req.params.id);

    const parentComments = await prisma.comments.findMany({
        where: { post_id: postId, parent_id: null },
        orderBy: { created_at: 'asc' },
    });

    const replies = await prisma.comments.findMany({
        where: { post_id: postId, parent_id: { not: null } },
        orderBy: { created_at: 'asc' },
    });

    const replyMap = {};
    for (const r of replies) {
        if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
        replyMap[r.parent_id].push(r);
    }

    const nested = parentComments.map(c => ({ ...c, replies: replyMap[c.id] || [] }));
    return res.json({ success: true, data: nested });
}));

// [POST] /posts/:id/comments
router.post('/posts/:id/comments', authMiddleware, catchAsync(async (req, res) => {
    const post_id = parseInt(req.params.id);
    const { content, parent_id = null } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, error: '내용을 입력해주세요.' });

    const comment = await prisma.comments.create({
        data: {
            post_id,
            parent_id: parent_id ? parseInt(parent_id) : null,
            content: content.trim(),
            author_id: req.user.id,
            author_name: req.user.name,
        }
    });

    await prisma.posts.update({ where: { id: post_id }, data: { comment_count: { increment: 1 } } });
    return res.status(201).json({ success: true, data: comment, message: '등록되었습니다.' });
}));

// [DELETE] /comments/:id
router.delete('/comments/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const comment = await prisma.comments.findUnique({ where: { id } });
    if (!comment) return res.status(404).json({ success: false, error: '댓글이 없습니다.' });
    if (comment.author_id !== req.user.id && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
    }

    const replyCount = await prisma.comments.count({ where: { parent_id: id } });
    await prisma.comments.deleteMany({ where: { parent_id: id } });
    await prisma.comments.delete({ where: { id } });
    await prisma.posts.update({
        where: { id: comment.post_id },
        data: { comment_count: { decrement: 1 + replyCount } }
    });

    return res.json({ success: true, message: '삭제되었습니다.' });
}));

// ── 와일드카드 /:type 라우트 (항상 마지막) ────────────────────────────────

// [GET] /trending
router.get('/trending', optionalAuth, catchAsync(async (req, res) => {
    const { limit = 5 } = req.query;
    const posts = await prisma.posts.findMany({
        orderBy: [{ like_count: 'desc' }, { view_count: 'desc' }],
        take: parseInt(limit),
        select: {
            id: true, board_type: true, title: true, author_name: true,
            view_count: true, like_count: true, comment_count: true,
            created_at: true, is_pinned: true, tags: true,
        }
    });
    return res.json({ success: true, data: posts });
}));

// [GET] /:type - 게시글 목록
router.get('/:type', optionalAuth, catchAsync(async (req, res) => {
    const { type } = req.params;
    const validTypes = ['notice', 'free', 'faq', 'qna'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, error: '유효하지 않은 게시판 타입입니다.' });
    }

    const { page = 1, limit = 12, search = '', searchType = 'title', tag = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { board_type: type };
    if (search) {
        if (searchType === 'title') where.title = { contains: search };
        else if (searchType === 'content') where.content = { contains: search };
        else if (searchType === 'author') where.author_name = { contains: search };
        else {where.OR = [
            { title: { contains: search } },
            { content: { contains: search } },
            { author_name: { contains: search } },
        ];}
    }
    if (tag) {
        where.tags = { contains: tag };
    }

    const [total, posts] = await Promise.all([
        prisma.posts.count({ where }),
        prisma.posts.findMany({
            where,
            orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
            take: parseInt(limit),
            skip,
        })
    ]);

    let likedPostIds = new Set();
    if (req.user) {
        const likes = await prisma.post_likes.findMany({
            where: { user_id: req.user.id, post_id: { in: posts.map(p => p.id) } },
            select: { post_id: true }
        });
        likedPostIds = new Set(likes.map(l => l.post_id));
    }

    const enriched = posts.map(p => ({ ...p, is_liked: likedPostIds.has(p.id) }));

    return res.json({
        success: true,
        data: {
            posts: enriched,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        }
    });
}));

// [POST] /:type - 게시글 작성
router.post('/:type', authMiddleware, catchAsync(async (req, res) => {
    const { type } = req.params;
    if (!['notice', 'free', 'faq', 'qna'].includes(type)) {
        return res.status(400).json({ success: false, error: '유효하지 않은 타입입니다.' });
    }
    if (['notice', 'faq'].includes(type) && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '해당 게시판은 관리자만 작성 가능합니다.' });
    }

    const { title, content, is_pinned = false, tags = '' } = req.body;
    if (!title || !content) {
        return res.status(400).json({ success: false, error: '제목과 내용을 모두 입력해주세요.' });
    }

    const normalizedTags = tags
        ? tags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean).slice(0, 5).join(',')
        : '';

    const post = await prisma.posts.create({
        data: {
            board_type: type,
            title: title.trim(),
            content: content.trim(),
            author_id: req.user.id,
            author_name: req.user.name,
            is_pinned: isAdmin(req.user) ? is_pinned : false,
            tags: normalizedTags,
            like_count: 0,
            view_count: 0,
            comment_count: 0,
        }
    });

    return res.status(201).json({ success: true, data: post, message: '등록되었습니다.' });
}));

module.exports = router;

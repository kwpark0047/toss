const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const authMiddleware = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');
const aiService = require('../services/aiService');

// [GET] 매장별 리뷰 목록 조회 (최신순)
router.get('/store/:storeId', catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const list = await prisma.reviews.findMany({
        where: { store_id: parseInt(storeId) },
        include: {
            _count: { select: { likes: true } }
        },
        orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: list });
}));

// [GET] 소셜 피드 (전체 매장 최신 리뷰)
router.get('/feed', catchAsync(async (req, res) => {
    const list = await prisma.reviews.findMany({
        include: {
            stores: { select: { name: true } },
            _count: { select: { likes: true } }
        },
        orderBy: { created_at: 'desc' },
        take: 20
    });
    res.json({ success: true, data: list });
}));

// [POST] 리뷰 등록
router.post('/', catchAsync(async (req, res) => {
    const { store_id, order_id, customer_name, customer_phone, rating, content, image_url } = req.body;
    if (order_id) {
        const existing = await prisma.reviews.findUnique({
            where: { order_id: parseInt(order_id) }
        });
        if (existing) {
            return res.status(400).json({ success: false, error: '이미 리뷰가 등록된 주문입니다.' });
        }
    }

    const review = await prisma.reviews.create({
        data: {
            store_id: parseInt(store_id),
            order_id: order_id ? parseInt(order_id) : null,
            customer_name,
            customer_phone,
            rating: parseInt(rating),
            content,
            image_url
        }
    });

    res.json({ success: true, data: review });
}));

// [POST] 리뷰 좋아요 (무인증, 브라우저별 익명 식별자로 토글)
router.post('/:id/like', catchAsync(async (req, res) => {
    const reviewId = parseInt(req.params.id);
    const { user_phone } = req.body;
    if (!user_phone) {
        return res.status(400).json({ success: false, error: '식별자가 필요합니다.' });
    }

    const existing = await prisma.review_likes.findFirst({
        where: { review_id: reviewId, user_phone }
    });

    let action;
    if (existing) {
        await prisma.review_likes.delete({ where: { id: existing.id } });
        action = 'unliked';
    } else {
        await prisma.review_likes.create({ data: { review_id: reviewId, user_phone } });
        action = 'liked';
    }

    const like_count = await prisma.review_likes.count({ where: { review_id: reviewId } });
    res.json({ success: true, action, liked: action === 'liked', like_count });
}));

// 리뷰 소속 매장에 대한 권한 확인 후 리뷰 반환 (공통 헬퍼)
async function loadReviewWithPermission(reviewId, user) {
    const review = await prisma.reviews.findUnique({
        where: { id: parseInt(reviewId) },
        include: { stores: { select: { id: true, name: true } } },
    });
    if (!review) return { error: { status: 404, message: '리뷰를 찾을 수 없습니다.' } };
    if (user.role !== 'super_admin') {
        const role = await getStoreRole(user.id, review.store_id);
        if (!role) return { error: { status: 403, message: '해당 매장에 대한 권한이 없습니다.' } };
    }
    return { review };
}

// [POST] AI 답글 초안 생성 (저장하지 않고 초안만 반환)
router.post('/:id/ai-reply', authMiddleware, catchAsync(async (req, res) => {
    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const draft = await aiService.generateReviewReply(
        { rating: review.rating, content: review.content, customer_name: review.customer_name },
        review.stores.name,
    );
    res.success({ draft }, 'AI 답글 초안이 생성되었습니다.');
}));

// [PUT] 사장님 답글 저장/수정
router.put('/:id/reply', authMiddleware, catchAsync(async (req, res) => {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
        return res.status(400).json({ success: false, error: '답글 내용을 입력해주세요.' });
    }

    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const updated = await prisma.reviews.update({
        where: { id: review.id },
        data: { reply: reply.trim(), replied_at: new Date() },
    });
    res.success(updated, '답글이 등록되었습니다.');
}));

// [DELETE] 답글 삭제
router.delete('/:id/reply', authMiddleware, catchAsync(async (req, res) => {
    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const updated = await prisma.reviews.update({
        where: { id: review.id },
        data: { reply: null, replied_at: null },
    });
    res.success(updated, '답글이 삭제되었습니다.');
}));

module.exports = router;

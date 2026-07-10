const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');
const aiService = require('../services/aiService');

// [GET] ë§¤ìž¥ë³?ë¦¬ë·° ëª©ë¡ ì¡°íšŒ (ìµœì‹ ??
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

// [GET] ?Œì…œ ?¼ë“œ (?„ì²´ ë§¤ìž¥ ìµœì‹  ë¦¬ë·°)
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

// [POST] ë¦¬ë·° ?±ë¡
router.post('/', catchAsync(async (req, res) => {
    const { store_id, order_id, customer_name, customer_phone, rating, content, image_url } = req.body;
    if (order_id) {
        const existing = await prisma.reviews.findUnique({
            where: { order_id: parseInt(order_id) }
        });
        if (existing) {
            return res.status(400).json({ success: false, error: '?´ë? ë¦¬ë·°ê°€ ?±ë¡??ì£¼ë¬¸?…ë‹ˆ??' });
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

// [POST] ë¦¬ë·° ì¢‹ì•„??(ë¬´ì¸ì¦? ë¸Œë¼?°ì?ë³??µëª… ?ë³„?ë¡œ ? ê?)
router.post('/:id/like', catchAsync(async (req, res) => {
    const reviewId = parseInt(req.params.id);
    const { user_phone } = req.body;
    if (!user_phone) {
        return res.status(400).json({ success: false, error: '?ë³„?ê? ?„ìš”?©ë‹ˆ??' });
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

// ë¦¬ë·° ?Œì† ë§¤ìž¥???€??ê¶Œí•œ ?•ì¸ ??ë¦¬ë·° ë°˜í™˜ (ê³µí†µ ?¬í¼)
async function loadReviewWithPermission(reviewId, user) {
    const review = await prisma.reviews.findUnique({
        where: { id: parseInt(reviewId) },
        include: { stores: { select: { id: true, name: true } } },
    });
    if (!review) return { error: { status: 404, message: 'ë¦¬ë·°ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.' } };
    if (user.role !== 'super_admin') {
        const role = await getStoreRole(user.id, review.store_id);
        if (!role) return { error: { status: 403, message: '?´ë‹¹ ë§¤ìž¥???€??ê¶Œí•œ???†ìŠµ?ˆë‹¤.' } };
    }
    return { review };
}

// [POST] AI ?µê? ì´ˆì•ˆ ?ì„± (?€?¥í•˜ì§€ ?Šê³  ì´ˆì•ˆë§?ë°˜í™˜)
router.post('/:id/ai-reply', authMiddleware, catchAsync(async (req, res) => {
    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const draft = await aiService.generateReviewReply(
        { rating: review.rating, content: review.content, customer_name: review.customer_name },
        review.stores.name,
    );
    res.success({ draft }, 'AI ?µê? ì´ˆì•ˆ???ì„±?˜ì—ˆ?µë‹ˆ??');
}));

// [PUT] ?¬ìž¥???µê? ?€???˜ì •
router.put('/:id/reply', authMiddleware, catchAsync(async (req, res) => {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
        return res.status(400).json({ success: false, error: '?µê? ?´ìš©???…ë ¥?´ì£¼?¸ìš”.' });
    }

    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const updated = await prisma.reviews.update({
        where: { id: review.id },
        data: { reply: reply.trim(), replied_at: new Date() },
    });
    res.success(updated, '?µê????±ë¡?˜ì—ˆ?µë‹ˆ??');
}));

// [DELETE] ?µê? ?? œ
router.delete('/:id/reply', authMiddleware, catchAsync(async (req, res) => {
    const { review, error } = await loadReviewWithPermission(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const updated = await prisma.reviews.update({
        where: { id: review.id },
        data: { reply: null, replied_at: null },
    });
    res.success(updated, '?µê????? œ?˜ì—ˆ?µë‹ˆ??');
}));

module.exports = router;


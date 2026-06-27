const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

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

// [POST] 리뷰 좋아요
router.post('/:id/like', catchAsync(async (req, res) => {
    const { id } = req.params;
    const { user_phone } = req.body;
    const existing = await prisma.review_likes.findFirst({
        where: {
            review_id: parseInt(id),
            user_phone
        }
    });

    if (existing) {
        await prisma.review_likes.delete({ where: { id: existing.id } });
        return res.json({ success: true, action: 'unliked' });
    }

    await prisma.review_likes.create({
        data: {
            review_id: parseInt(id),
            user_phone
        }
    });

    res.json({ success: true, action: 'liked' });
}));

module.exports = router;

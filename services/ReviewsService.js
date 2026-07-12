const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const aiService = require('../services/aiService');
const { getStoreRole } = require('../middleware/storeAuth');

class ReviewsService {
    /**
     * 매장별 리뷰 목록 조회 (최신순)
     */
    async getStoreReviews(storeId) {
        return await prisma.reviews.findMany({
            where: { store_id: parseInt(storeId) },
            include: {
                _count: { select: { likes: true } }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * 리뷰 피드 (전체 매장 최신 리뷰)
     */
    async getFeed() {
        return await prisma.reviews.findMany({
            include: {
                stores: { select: { name: true } },
                _count: { select: { likes: true } }
            },
            orderBy: { created_at: 'desc' },
            take: 20
        });
    }

    /**
     * 리뷰 등록
     */
    async createReview(data) {
        const { store_id, order_id, customer_name, customer_phone, rating, content, image_url } = data;

        if (order_id) {
            const existing = await prisma.reviews.findUnique({
                where: { order_id: parseInt(order_id) }
            });
            if (existing) {
                throw new AppError('이미 리뷰가 등록된 주문입니다.', 400);
            }
        }

        return await prisma.reviews.create({
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
    }

    /**
     * 리뷰 좋아요 토글
     */
    async toggleLike(reviewId, userPhone) {
        const existing = await prisma.review_likes.findFirst({
            where: { review_id: reviewId, user_phone: userPhone }
        });

        let action;
        if (existing) {
            await prisma.review_likes.delete({ where: { id: existing.id } });
            action = 'unliked';
        } else {
            await prisma.review_likes.create({ data: { review_id: reviewId, user_phone: userPhone } });
            action = 'liked';
        }

        const like_count = await prisma.review_likes.count({ where: { review_id: reviewId } });
        return { action, liked: action === 'liked', like_count };
    }

    /**
     * 리뷰 + 권한 검증 (공통 로더)
     */
    async loadReviewWithPermission(reviewId, user) {
        const review = await prisma.reviews.findUnique({
            where: { id: parseInt(reviewId) },
            include: { stores: { select: { id: true, name: true } } },
        });
        if (!review) {
            throw new AppError('리뷰를 찾을 수 없습니다.', 404);
        }
        if (user.role !== 'super_admin') {
            const role = await getStoreRole(user.id, review.store_id);
            if (!role) {
                throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
            }
        }
        return review;
    }

    /**
     * AI 리뷰 초안 생성
     */
    async generateAiReply(reviewId, user) {
        const review = await this.loadReviewWithPermission(reviewId, user);
        const draft = await aiService.generateReviewReply(
            { rating: review.rating, content: review.content, customer_name: review.customer_name },
            review.stores.name,
        );
        return { draft };
    }

    /**
     * 리플라이 등록/수정
     */
    async setReply(reviewId, reply, user) {
        const review = await this.loadReviewWithPermission(reviewId, user);
        return await prisma.reviews.update({
            where: { id: review.id },
            data: { reply: reply.trim(), replied_at: new Date() },
        });
    }

    /**
     * 리플라이 삭제
     */
    async deleteReply(reviewId, user) {
        const review = await this.loadReviewWithPermission(reviewId, user);
        return await prisma.reviews.update({
            where: { id: review.id },
            data: { reply: null, replied_at: null },
        });
    }
}

module.exports = ReviewsService;

jest.mock('../../../config/prisma', () => ({
    reviews: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    review_likes: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
}));
jest.mock('../../../services/aiService', () => ({
    generateReviewReply: jest.fn(),
}));
jest.mock('../../../middleware/storeAuth', () => ({
    getStoreRole: jest.fn(),
}));

const ReviewsService = require('../../../services/ReviewsService');
const prisma = require('../../../config/prisma');
const aiService = require('../../../services/aiService');
const { getStoreRole } = require('../../../middleware/storeAuth');

describe('ReviewsService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new ReviewsService();
    });

    describe('getStoreReviews', () => {
        test('매장별 리뷰 목록을 조회한다', async () => {
            prisma.reviews.findMany.mockResolvedValue([
                { id: 1, rating: 5, _count: { likes: 3 } }
            ]);
            const result = await svc.getStoreReviews(1);
            expect(prisma.reviews.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { store_id: 1 }
            }));
            expect(result).toHaveLength(1);
        });
    });

    describe('getFeed', () => {
        test('전체 리뷰 피드를 20개 반환한다', async () => {
            prisma.reviews.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const result = await svc.getFeed();
            expect(prisma.reviews.findMany).toHaveBeenCalledWith(expect.objectContaining({
                take: 20
            }));
            expect(result).toHaveLength(2);
        });
    });

    describe('createReview', () => {
        test('리뷰를 등록한다', async () => {
            prisma.reviews.findUnique.mockResolvedValue(null);
            prisma.reviews.create.mockResolvedValue({ id: 10, rating: 5 });
            const result = await svc.createReview({
                store_id: 1, customer_name: '홍길동', rating: 5, content: '맛있다'
            });
            expect(prisma.reviews.create).toHaveBeenCalled();
            expect(result.rating).toBe(5);
        });

        test('이미 리뷰가 있는 주문이면 400 에러를 반환한다', async () => {
            prisma.reviews.findUnique.mockResolvedValue({ id: 1 });
            await expect(svc.createReview({ store_id: 1, order_id: 100 }))
                .rejects.toThrow('이미 리뷰가 등록된 주문입니다.');
        });
    });

    describe('toggleLike', () => {
        test('좋아요를 토글한다 - 좋아요 추가', async () => {
            prisma.review_likes.findFirst.mockResolvedValue(null);
            prisma.review_likes.create.mockResolvedValue({});
            prisma.review_likes.count.mockResolvedValue(1);

            const result = await svc.toggleLike(1, '01012345678');
            expect(result.action).toBe('liked');
            expect(result.like_count).toBe(1);
        });

        test('좋아요를 토글한다 - 좋아요 취소', async () => {
            prisma.review_likes.findFirst.mockResolvedValue({ id: 1 });
            prisma.review_likes.delete.mockResolvedValue({});
            prisma.review_likes.count.mockResolvedValue(0);

            const result = await svc.toggleLike(1, '01012345678');
            expect(result.action).toBe('unliked');
            expect(result.liked).toBe(false);
        });
    });

    describe('loadReviewWithPermission', () => {
        test('super_admin은 어떤 리뷰든 접근 가능', async () => {
            prisma.reviews.findUnique.mockResolvedValue({
                id: 1, store_id: 1, stores: { id: 1, name: '테스트' }
            });
            const result = await svc.loadReviewWithPermission(1, { id: 1, role: 'super_admin' });
            expect(getStoreRole).not.toHaveBeenCalled();
            expect(result.id).toBe(1);
        });

        test('리뷰가 없으면 404 에러', async () => {
            prisma.reviews.findUnique.mockResolvedValue(null);
            await expect(svc.loadReviewWithPermission(999, { id: 1, role: 'super_admin' }))
                .rejects.toThrow('리뷰를 찾을 수 없습니다.');
        });

        test('매장 권한이 없으면 403 에러', async () => {
            prisma.reviews.findUnique.mockResolvedValue({
                id: 1, store_id: 1, stores: { id: 1, name: '테스트' }
            });
            getStoreRole.mockResolvedValue(null);
            await expect(svc.loadReviewWithPermission(1, { id: 1, role: 'owner' }))
                .rejects.toThrow('해당 매장에 대한 권한이 없습니다.');
        });
    });

    describe('generateAiReply', () => {
        test('AI 리뷰 초안을 생성한다', async () => {
            prisma.reviews.findUnique.mockResolvedValue({
                id: 1, rating: 5, content: '맛있어요', customer_name: '홍길동',
                stores: { id: 1, name: '테스트매장' }
            });
            aiService.generateReviewReply.mockResolvedValue('감사합니다.');

            const result = await svc.generateAiReply(1, { id: 1, role: 'super_admin' });
            expect(result.draft).toBe('감사합니다.');
        });
    });

    describe('setReply', () => {
        test('리플라이를 등록/수정한다', async () => {
            prisma.reviews.findUnique.mockResolvedValue({
                id: 1, store_id: 1, stores: { id: 1, name: '테스트' }
            });
            prisma.reviews.update.mockResolvedValue({ id: 1, reply: '감사합니다' });

            const result = await svc.setReply(1, '감사합니다', { id: 1, role: 'super_admin' });
            expect(prisma.reviews.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ reply: '감사합니다' })
            }));
        });
    });

    describe('deleteReply', () => {
        test('리플라이를 삭제한다', async () => {
            prisma.reviews.findUnique.mockResolvedValue({
                id: 1, store_id: 1, stores: { id: 1, name: '테스트' }
            });
            prisma.reviews.update.mockResolvedValue({ id: 1, reply: null });

            await svc.deleteReply(1, { id: 1, role: 'super_admin' });
            expect(prisma.reviews.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { reply: null, replied_at: null }
            }));
        });
    });
});

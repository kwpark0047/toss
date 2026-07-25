// reviewsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    getStoreReviews: jest.fn(),
    getFeed: jest.fn(),
    createReview: jest.fn(),
    toggleLike: jest.fn(),
    generateAiReply: jest.fn(),
    setReply: jest.fn(),
    deleteReply: jest.fn(),
};
jest.mock('../../../services/ReviewsService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const reviewsController = require('../../../controllers/reviewsController');

describe('reviewsController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10, role: 'owner' } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
        next = jest.fn();
    });

    describe('getStoreReviews', () => {
        test('매장별 리뷰 목록을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreReviews.mockResolvedValue([{ id: 1 }]);
            await reviewsController.getStoreReviews(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
        });
    });

    describe('getFeed', () => {
        test('리뷰 피드를 조회한다', async () => {
            mockService.getFeed.mockResolvedValue([{ id: 1 }]);
            await reviewsController.getFeed(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
        });
    });

    describe('createReview', () => {
        test('리뷰를 등록한다', async () => {
            req.body = { store_id: 1, rating: 5, comment: '맛있어요' };
            mockService.createReview.mockResolvedValue({ id: 1 });
            await reviewsController.createReview(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
        });
    });

    describe('toggleLike', () => {
        test('좋아요를 토글한다', async () => {
            req.params.id = '1';
            req.body = { user_phone: '01012345678' };
            mockService.toggleLike.mockResolvedValue({ liked: true });
            await reviewsController.toggleLike(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, liked: true });
        });

        test('식별 정보 없으면 400', async () => {
            req.params.id = '1';
            req.body = {};
            await expect(reviewsController.toggleLike(req, res, next)).rejects.toThrow('식별 정보가 필요합니다.');
        });
    });

    describe('generateAiReply', () => {
        test('AI 리뷰 초안을 생성한다', async () => {
            req.params.id = '1';
            mockService.generateAiReply.mockResolvedValue({ reply: '감사합니다' });
            await reviewsController.generateAiReply(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('setReply', () => {
        test('리플라이를 등록한다', async () => {
            req.params.id = '1';
            req.body = { reply: '감사합니다!' };
            mockService.setReply.mockResolvedValue({ reply: '감사합니다!' });
            await reviewsController.setReply(req, res);
            expect(res.success).toHaveBeenCalled();
        });

        test('리플라이 내용 없으면 400', async () => {
            req.params.id = '1';
            req.body = { reply: '' };
            await expect(reviewsController.setReply(req, res, next)).rejects.toThrow('리플라이 내용을 입력해주세요.');
        });
    });

    describe('deleteReply', () => {
        test('리플라이를 삭제한다', async () => {
            req.params.id = '1';
            mockService.deleteReply.mockResolvedValue({ reply: null });
            await reviewsController.deleteReply(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });
});

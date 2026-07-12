const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const ReviewsService = require('../services/ReviewsService');

const reviewsService = new ReviewsService();

const reviewsController = {
    // [GET] 매장별 리뷰 목록 조회
    getStoreReviews: catchAsync(async (req, res) => {
        const list = await reviewsService.getStoreReviews(req.params.storeId);
        res.json({ success: true, data: list });
    }),

    // [GET] 리뷰 피드 (전체 매장 최신 리뷰)
    getFeed: catchAsync(async (req, res) => {
        const list = await reviewsService.getFeed();
        res.json({ success: true, data: list });
    }),

    // [POST] 리뷰 등록
    createReview: catchAsync(async (req, res) => {
        const review = await reviewsService.createReview(req.body);
        res.json({ success: true, data: review });
    }),

    // [POST] 리뷰 좋아요 토글
    toggleLike: catchAsync(async (req, res) => {
        const { user_phone } = req.body;
        if (!user_phone) {
            throw new AppError('식별 정보가 필요합니다.', 400);
        }
        const result = await reviewsService.toggleLike(parseInt(req.params.id), user_phone);
        res.json({ success: true, ...result });
    }),

    // [POST] AI 리뷰 초안 생성
    generateAiReply: catchAsync(async (req, res) => {
        const result = await reviewsService.generateAiReply(req.params.id, req.user);
        res.success(result, 'AI 리뷰 초안이 생성되었습니다.');
    }),

    // [PUT] 리플라이 등록/수정
    setReply: catchAsync(async (req, res) => {
        const { reply } = req.body;
        if (!reply || !reply.trim()) {
            throw new AppError('리플라이 내용을 입력해주세요.', 400);
        }
        const updated = await reviewsService.setReply(req.params.id, reply, req.user);
        res.success(updated, '리플라이가 등록되었습니다.');
    }),

    // [DELETE] 리플라이 삭제
    deleteReply: catchAsync(async (req, res) => {
        const updated = await reviewsService.deleteReply(req.params.id, req.user);
        res.success(updated, '리플라이가 삭제되었습니다.');
    })
};

module.exports = reviewsController;

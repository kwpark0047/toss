const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const pointsService = require('../services/PointsService');

const pointsController = {
    // 포인트 잔액 조회 (인증된 사용자 본인만)
    getBalance: catchAsync(async (req, res) => {
        const identifier = { user_id: req.user.id };
        const balance = await pointsService.getBalance(identifier);
        res.json(balance);
    }),

    // 포인트 내역 조회 (인증된 사용자 본인만)
    getHistory: catchAsync(async (req, res) => {
        const { store_id, type, limit, offset } = req.query;
        const identifier = { user_id: req.user.id };
        const result = await pointsService.getHistory(identifier, {
            store_id: store_id ? parseInt(store_id) : undefined,
            type,
            limit: limit ? parseInt(limit) : 20,
            offset: offset ? parseInt(offset) : 0
        });
        res.json(result);
    }),

    // 월렛 조회 (인증 미필요)
    walletLookup: catchAsync(async (req, res) => {
        const { phone, toss_user_key, store_id } = req.query;
        if (!phone && !toss_user_key) {
            throw new AppError('휴대폰 번호 또는 식별 정보가 필요합니다.', 400);
        }
        const identifier = {};
        if (phone) identifier.phone = phone;
        if (toss_user_key) identifier.toss_user_key = toss_user_key;
        const result = await pointsService.walletLookup(identifier, store_id ? parseInt(store_id) : null);
        res.json(result);
    }),

    // 예상 적립 포인트 계산
    calculateEarnPoints: catchAsync(async (req, res) => {
        const { amount, store_id } = req.query;
        const earnPoints = await pointsService.calculateEarnPoints(parseInt(amount), parseInt(store_id));
        res.json({ earn_points: earnPoints });
    }),

    // 사용 가능 포인트 계산
    calculateUsablePoints: catchAsync(async (req, res) => {
        const { amount, store_id } = req.query;
        const result = await pointsService.calculateUsablePoints(parseInt(amount), parseInt(store_id), req.user.id);
        res.json(result);
    }),

    // 매장 포인트 설정 조회
    getStoreSettings: catchAsync(async (req, res) => {
        const settings = await pointsService.getStoreSettings(parseInt(req.params.storeId));
        res.json(settings);
    }),

    // 매장 포인트 설정 업데이트 (관리자용)
    updateStoreSettings: catchAsync(async (req, res) => {
        const settings = await pointsService.updateStoreSettings(parseInt(req.params.storeId), req.body);
        res.json(settings);
    }),

    // 수동 포인트 적립 (super_admin 또는 admin 전용)
    adminEarn: catchAsync(async (req, res, next) => {
        // 원래 라우터에서 requireAdminOrSuperAdmin 미들웨어로 검증하던 역할 체크
        if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
            return next(new AppError('권한이 없습니다. 최고관리자 또는 매장관리자만 접근 가능합니다.', 403));
        }
        const { toss_user_key, phone, user_id, store_id, amount, description } = req.body;
        if (!store_id || !amount) {
            return next(new AppError('매장 ID와 금액이 필요합니다', 400));
        }
        if (!toss_user_key && !phone && !user_id) {
            return next(new AppError('사용자 식별 정보가 필요합니다', 400));
        }
        const identifier = {};
        if (toss_user_key) identifier.toss_user_key = toss_user_key;
        else if (phone) identifier.phone = phone;
        else if (user_id) identifier.user_id = parseInt(user_id);
        const result = await pointsService.adminEarn(identifier, parseInt(store_id), parseInt(amount), description);
        res.json(result);
    }),

    // 수동 포인트 차감 (super_admin 전용)
    adminDeduct: catchAsync(async (req, res, next) => {
        if (req.user.role !== 'super_admin') {
            return next(new AppError('권한이 없습니다. 최고관리자만 접근 가능합니다.', 403));
        }
        const { toss_user_key, phone, user_id, store_id, amount, description } = req.body;
        if (!store_id || !amount) {
            return next(new AppError('매장 ID와 금액이 필요합니다', 400));
        }
        if (!toss_user_key && !phone && !user_id) {
            return next(new AppError('사용자 식별 정보가 필요합니다', 400));
        }
        const identifier = {};
        if (toss_user_key) identifier.toss_user_key = toss_user_key;
        else if (phone) identifier.phone = phone;
        else if (user_id) identifier.user_id = parseInt(user_id);
        const result = await pointsService.adminDeduct(identifier, parseInt(store_id), parseInt(amount), description);
        res.json(result);
    })
};

module.exports = pointsController;

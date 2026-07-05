const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const Point = require('../models/Point');
const StoreTier = require('../models/StoreTier');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { validateBody, validateId } = require('../middleware/validator');
const { AppError } = require('../utils/errorHandler');

// 포인트 잔액 조회 (인증된 사용자 본인만)
router.get('/balance', authMiddleware, async (req, res, _next) => {
    const identifier = { user_id: req.user.id };
    const balance = await Point.getBalance(identifier);
    res.json(balance);
});

// 포인트 내역 조회 (인증된 사용자 본인만)
router.get('/history', authMiddleware, async (req, res, _next) => {
    const { store_id, type, limit, offset } = req.query;
    const identifier = { user_id: req.user.id };
    const history = await Point.getHistory(identifier, {
        store_id: store_id ? parseInt(store_id) : undefined,
        type,
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0
    });
    res.json({
        transactions: history,
        pagination: {
            limit: limit ? parseInt(limit) : 20,
            offset: offset ? parseInt(offset) : 0
        }
    });
});

router.get('/wallet-lookup', async (req, res, _next) => {
    const { phone, toss_user_key, store_id } = req.query;
    if (!phone && !toss_user_key) {
        return res.status(400).json({ error: '휴대폰 번호 또는 식별 정보가 필요합니다.' });
    }
    const identifier = {};
    if (phone) identifier.phone = phone;
    if (toss_user_key) identifier.toss_user_key = toss_user_key;
    const balance = await Point.getBalance(identifier);
    const history = await Point.getHistory(identifier, {
        store_id: store_id ? parseInt(store_id) : undefined,
        limit: 5
    });
    let storeSettings = null;
    let tierInfo = null;
    if (store_id) {
        storeSettings = await Point.getStoreSettings(parseInt(store_id));
        if (balance.user_id || balance.phone || balance.toss_user_key) {
            const userPoint = await prisma.user_points.findFirst({
                where: {
                    OR: [
                        { id: balance.id },
                        { phone: phone || undefined },
                        { toss_user_key: toss_user_key || undefined }
                    ]
                }
            });
            if (userPoint) {
                const customer = await prisma.store_customers.findFirst({
                    where: {
                        store_id: parseInt(store_id),
                        OR: [
                            { customer_phone: userPoint.phone || undefined },
                            { toss_user_key: userPoint.toss_user_key || undefined }
                        ]
                    }
                });
                if (customer) {
                    const tiers = await StoreTier.getTiers(store_id);
                    const currentTier = tiers.find(t => t.tier_name === customer.tier) || { tier_name: 'GENERAL', earn_rate: 1.0, min_spent: 0 };
                    const nextTier = tiers.find(t => t.min_spent > customer.total_spent);
                    tierInfo = {
                        current: currentTier,
                        next: nextTier || null,
                        total_spent: customer.total_spent,
                        remaining_for_next: nextTier ? nextTier.min_spent - customer.total_spent : 0
                    };
                }
            }
        }
    }
    res.json({
        balance,
        history: history || [],
        store_settings: storeSettings,
        tier_info: tierInfo
    });
});

// 예상 적립 포인트 계산
router.get('/calculate-earn', validateId(['store_id', 'amount']), async (req, res, _next) => {
    const { amount, store_id } = req.query;
    const earnPoints = await Point.calculateEarnPoints(parseInt(amount), parseInt(store_id));
    res.json({ earn_points: earnPoints });
});

// 사용 가능 포인트 계산
router.get('/calculate-usable', authMiddleware, validateId(['store_id', 'amount']), async (req, res, _next) => {
    const { amount, store_id } = req.query;
    const identifier = { user_id: req.user.id };
    const balance = await Point.getBalance(identifier);
    const usablePoints = await Point.calculateUsablePoints(parseInt(amount), balance.total_points, parseInt(store_id));
    res.json({ total_points: balance.total_points, usable_points: usablePoints, max_discount: usablePoints });
});

// 매장 포인트 설정 조회
router.get('/settings/:storeId', async (req, res, _next) => {
    const settings = await Point.getStoreSettings(parseInt(req.params.storeId));
    res.json(settings);
});

// 매장 포인트 설정 업데이트 (관리자용)
router.put('/settings/:storeId', authMiddleware, checkStorePermission('store:update'), async (req, res, _next) => {
    const settings = await Point.updateStoreSettings(parseInt(req.params.storeId), req.body);
    res.json(settings);
});

// 수동 포인트 적립 (super_admin 또는 owner 전용)
function requireAdminOrSuperAdmin(req, res, next) {
    if (req.user.role === 'super_admin' || req.user.role === 'admin') return next();
    return next(new AppError('권한이 없습니다. 최고관리자 또는 매장관리자만 접근 가능합니다.', 403));
}

router.post('/admin/earn', authMiddleware, requireAdminOrSuperAdmin, validateBody(['store_id', 'amount']), async (req, res, next) => {
    const { toss_user_key, phone, user_id, store_id, amount, description } = req.body;
    if (!toss_user_key && !phone && !user_id) {
        return next(new AppError('사용자 식별 정보가 필요합니다', 400));
    }
    const identifier = {};
    if (toss_user_key) identifier.toss_user_key = toss_user_key;
    else if (phone) identifier.phone = phone;
    else if (user_id) identifier.user_id = parseInt(user_id);
    const result = await Point.earn({
        identifier,
        store_id: parseInt(store_id),
        amount: parseInt(amount),
        description: description || '관리자 수동 적립'
    });
    res.json(result);
});

// 수동 포인트 차감 (super_admin 전용)
router.post('/admin/deduct', authMiddleware, async (req, res, next) => {
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
    const result = await Point.use({
        identifier,
        store_id: parseInt(store_id),
        amount: parseInt(amount),
        description: description || '관리자 수동 차감'
    });
    res.json(result);
});

module.exports = router;

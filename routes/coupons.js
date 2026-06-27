const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

// === [관리자: 쿠폰 관리] ===

// 매장 쿠폰 목록 조회
router.get('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const coupons = await Coupon.getStoreCoupons(req.params.storeId);
    res.success(coupons);
}));

// 쿠폰 생성
router.post('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const coupon = await Coupon.create({
        store_id: parseInt(req.params.storeId),
        ...req.body
    });
    res.success(coupon, '쿠폰이 생성되었습니다.');
}));

// === [관리자: 캠페인 설정] ===

// 매장 캠페인 목록 조회
router.get('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const campaigns = await prisma.campaign_settings.findMany({
        where: { store_id: parseInt(req.params.storeId) },
        include: { coupons: true }
    });
    res.success(campaigns);
}));

// 캠페인 저장/수정
router.post('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const { id, trigger_type, target_tier, coupon_id, is_active } = req.body;
    const data = {
        store_id: parseInt(req.params.storeId),
        trigger_type,
        target_tier,
        coupon_id: parseInt(coupon_id),
        is_active: is_active ?? 1,
        updated_at: new Date()
    };

    let campaign;
    if (id) {
        campaign = await prisma.campaign_settings.update({
            where: { id: parseInt(id) },
            data
        });
    } else {
        campaign = await prisma.campaign_settings.create({ data });
    }
    res.success(campaign, '캠페인이 저장되었습니다.');
}));

// === [고객: 쿠폰 조회] ===

// 내 사용 가능한 쿠폰 조회
router.get('/my-coupons', authMiddleware, catchAsync(async (req, res) => {
    const userPoints = await prisma.user_points.findFirst({
        where: { user_id: req.user.id }
    });

    if (!userPoints || !userPoints.phone) {
        return res.success([], '보유 중인 쿠폰이 없습니다.');
    }

    const coupons = await Coupon.getCustomerCoupons(userPoints.phone, req.query.store_id);
    res.success(coupons);
}));

module.exports = router;

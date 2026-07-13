const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/couponsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');

// === [관리자: 쿠폰 관리] ===

// 매장 쿠폰 목록 조회
router.get('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:read'), catchAsync(couponsController.getStoreCoupons));

// 쿠폰 생성
router.post('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:write'), catchAsync(couponsController.createCoupon));

// === [관리자: 캠페인 설정] ===

// 매장 캠페인 목록 조회
router.get('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:read'), catchAsync(couponsController.getStoreCampaigns));

// 캠페인 추가/수정
router.post('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:write'), catchAsync(couponsController.saveCampaign));

// === [고객: 쿠폰 조회] ===

// 내가 사용 가능한 쿠폰 조회
router.get('/my-coupons', authMiddleware, catchAsync(couponsController.getMyCoupons));

module.exports = router;

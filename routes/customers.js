const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const customerController = require('../controllers/customerController');

// ── 공개 라우트 (인증 불필요) ──
router.post('/phone-join', catchAsync(customerController.phoneJoin));
router.post('/update-location', catchAsync(customerController.updateLocation));
router.post('/fcm-token', catchAsync(customerController.registerFcmToken));

// ── 특정 단골고객 상세 (/:storeId 보다 먼저 등록 - "detail"이 storeId로 매칭되는 버그 방지) ──
router.get('/detail/:customerId', authMiddleware, catchAsync(customerController.getDetail));

// ── 관리자 전용 (인증 + 권한) ──
router.get('/:storeId/stats', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getStats));
router.get('/:storeId/customer/:customerId/history', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getHistory));
router.get('/:storeId/coupons', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getCoupons));
router.post('/:storeId/customer/:customerId/coupon', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.issueCoupon));
router.get('/:storeId', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getCustomers));

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { validateBody, validateId } = require('../middleware/validator');
const pointsController = require('../controllers/pointsController');

// 포인트 잔액 조회 (인증된 사용자 본인만)
router.get('/balance', authMiddleware, pointsController.getBalance);

// 포인트 내역 조회 (인증된 사용자 본인만)
router.get('/history', authMiddleware, pointsController.getHistory);

// 월렛 조회
router.get('/wallet-lookup', pointsController.walletLookup);

// 예상 적립 포인트 계산
router.get('/calculate-earn', validateId(['store_id', 'amount']), pointsController.calculateEarnPoints);

// 사용 가능 포인트 계산
router.get('/calculate-usable', authMiddleware, validateId(['store_id', 'amount']), pointsController.calculateUsablePoints);

// 매장 포인트 설정 조회
router.get('/settings/:storeId', pointsController.getStoreSettings);

// 매장 포인트 설정 업데이트 (관리자용)
router.put('/settings/:storeId', authMiddleware, checkStorePermission('store:update'), pointsController.updateStoreSettings);

// 수동 포인트 적립 (super_admin 또는 admin 전용)
router.post('/admin/earn', authMiddleware, validateBody(['store_id', 'amount']), pointsController.adminEarn);

// 수동 포인트 차감 (super_admin 전용)
router.post('/admin/deduct', authMiddleware, pointsController.adminDeduct);

module.exports = router;

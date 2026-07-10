const express = require('express');
const router = express.Router();
const legalController = require('../controllers/legalController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// ── 공개 API ────────────────────────────────────────────────────────────────

// 전자상거래법 필수 표시 사항 조회
router.get('/stores/:storeId', legalController.getStoreDisclosures);

// 이용약관 조회
router.get('/stores/:storeId/terms', legalController.getStoreTerms);

// 개인정보처리방침 조회
router.get('/stores/:storeId/privacy', legalController.getStorePrivacy);

// 환불·취소 정책 조회
router.get('/stores/:storeId/refund', legalController.getStoreRefundPolicy);

// ── 관리자 전용 ─────────────────────────────────────────────────────────────

// 전체 법적 정보 조회
router.get('/admin/stores/:storeId', authMiddleware, checkStorePermission('settings:read'), legalController.adminGetStoreLegal);

// 법적 정보 수정
router.put('/admin/stores/:storeId', authMiddleware, checkStorePermission('settings:update'), legalController.adminUpdateStoreLegal);

// 사업자번호 유효성 검증
router.post('/admin/stores/:storeId/verify-business', authMiddleware, legalController.adminVerifyBusiness);

module.exports = router;

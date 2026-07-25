const express = require('express');
const router = express.Router();
const legalController = require('../controllers/legalController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: Legal
 *   description: 법적 정보/이용약관 API
 */

/**
 * @swagger
 * /api/legal/stores/{storeId}:
 *   get:
 *     tags: [Legal]
 *     summary: 전자상거래법 필수 표시 사항 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 필수 표시 사항
 */
router.get('/stores/:storeId', legalController.getStoreDisclosures);

/**
 * @swagger
 * /api/legal/stores/{storeId}/terms:
 *   get:
 *     tags: [Legal]
 *     summary: 이용약관 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 이용약관 내용
 */
router.get('/stores/:storeId/terms', legalController.getStoreTerms);

/**
 * @swagger
 * /api/legal/stores/{storeId}/privacy:
 *   get:
 *     tags: [Legal]
 *     summary: 개인정보처리방침 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 개인정보처리방침 내용
 */
router.get('/stores/:storeId/privacy', legalController.getStorePrivacy);

/**
 * @swagger
 * /api/legal/stores/{storeId}/refund:
 *   get:
 *     tags: [Legal]
 *     summary: 환불/취소 정책 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 환불/취소 정책 내용
 */
router.get('/stores/:storeId/refund', legalController.getStoreRefundPolicy);

/**
 * @swagger
 * /api/legal/admin/stores/{storeId}:
 *   get:
 *     tags: [Legal]
 *     summary: 전체 법적 정보 조회 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 법적 정보 전체
 */
router.get('/admin/stores/:storeId', authMiddleware, checkStorePermission('settings:read'), legalController.adminGetStoreLegal);

/**
 * @swagger
 * /api/legal/admin/stores/{storeId}:
 *   put:
 *     tags: [Legal]
 *     summary: 법적 정보 수정 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put('/admin/stores/:storeId', authMiddleware, checkStorePermission('settings:update'), legalController.adminUpdateStoreLegal);

/**
 * @swagger
 * /api/legal/admin/stores/{storeId}/verify-business:
 *   post:
 *     tags: [Legal]
 *     summary: 사업자번호 유효성 검증 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: 검증 결과
 */
router.post('/admin/stores/:storeId/verify-business', authMiddleware, legalController.adminVerifyBusiness);

module.exports = router;

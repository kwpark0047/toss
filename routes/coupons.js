const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/couponsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: 쿠폰 및 캠페인 관리 API
 */

/**
 * @swagger
 * /api/coupons/stores/{storeId}/coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: 매장 쿠폰 목록 조회 (관리자)
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
 *         description: 쿠폰 목록
 */
router.get('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:read'), catchAsync(couponsController.getStoreCoupons));

/**
 * @swagger
 * /api/coupons/stores/{storeId}/coupons:
 *   post:
 *     tags: [Coupons]
 *     summary: 쿠폰 생성 (관리자)
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
 *             required: [name, discountType, discountValue]
 *             properties:
 *               name:
 *                 type: string
 *               discountType:
 *                 type: string
 *                 enum: [fixed, percent]
 *               discountValue:
 *                 type: integer
 *               minOrderAmount:
 *                 type: integer
 *               maxDiscountAmount:
 *                 type: integer
 *               expiresAt:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: 쿠폰 생성 완료
 */
router.post('/stores/:storeId/coupons', authMiddleware, checkStorePermission('settings:write'), catchAsync(couponsController.createCoupon));

/**
 * @swagger
 * /api/coupons/stores/{storeId}/campaigns:
 *   get:
 *     tags: [Coupons]
 *     summary: 매장 캠페인 목록 조회 (관리자)
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
 *         description: 캠페인 목록
 */
router.get('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:read'), catchAsync(couponsController.getStoreCampaigns));

/**
 * @swagger
 * /api/coupons/stores/{storeId}/campaigns:
 *   post:
 *     tags: [Coupons]
 *     summary: 캠페인 추가/수정 (관리자)
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
 *               campaignId:
 *                 type: integer
 *               name:
 *                 type: string
 *               couponId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 캠페인 저장 완료
 */
router.post('/stores/:storeId/campaigns', authMiddleware, checkStorePermission('settings:write'), catchAsync(couponsController.saveCampaign));

/**
 * @swagger
 * /api/coupons/my-coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: 내가 사용 가능한 쿠폰 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용 가능한 쿠폰 목록
 */
router.get('/my-coupons', authMiddleware, catchAsync(couponsController.getMyCoupons));

module.exports = router;

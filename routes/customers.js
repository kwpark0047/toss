const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const customerController = require('../controllers/customerController');

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: 고객 관리 API
 */

/**
 * @swagger
 * /api/customers/phone-join:
 *   post:
 *     tags: [Customers]
 *     summary: 전화번호로 고객 등록/조회
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 고객 정보
 */
router.post('/phone-join', catchAsync(customerController.phoneJoin));

/**
 * @swagger
 * /api/customers/update-location:
 *   post:
 *     tags: [Customers]
 *     summary: 고객 위치 업데이트 (지오펜싱용)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: 위치 업데이트 완료
 */
router.post('/update-location', catchAsync(customerController.updateLocation));

/**
 * @swagger
 * /api/customers/fcm-token:
 *   post:
 *     tags: [Customers]
 *     summary: FCM 푸시 토큰 등록
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 토큰 등록 완료
 */
router.post('/fcm-token', catchAsync(customerController.registerFcmToken));

/**
 * @swagger
 * /api/customers/detail/{customerId}:
 *   get:
 *     tags: [Customers]
 *     summary: 특정 단골고객 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 고객 상세 정보
 */
router.get('/detail/:customerId', authMiddleware, catchAsync(customerController.getDetail));

/**
 * @swagger
 * /api/customers/{storeId}/stats:
 *   get:
 *     tags: [Customers]
 *     summary: 매장별 고객 통계 조회
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
 *         description: 고객 통계
 */
router.get('/:storeId/stats', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getStats));

/**
 * @swagger
 * /api/customers/{storeId}/customer/{customerId}/history:
 *   get:
 *     tags: [Customers]
 *     summary: 특정 고객 주문 이력 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 고객 주문 이력
 */
router.get('/:storeId/customer/:customerId/history', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getHistory));

/**
 * @swagger
 * /api/customers/{storeId}/coupons:
 *   get:
 *     tags: [Customers]
 *     summary: 매장 쿠폰 목록 조회
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
router.get('/:storeId/coupons', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getCoupons));

/**
 * @swagger
 * /api/customers/{storeId}/customer/{customerId}/coupon:
 *   post:
 *     tags: [Customers]
 *     summary: 특정 고객에게 쿠폰 발급
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [couponId]
 *             properties:
 *               couponId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 쿠폰 발급 완료
 */
router.post('/:storeId/customer/:customerId/coupon', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.issueCoupon));

/**
 * @swagger
 * /api/customers/{storeId}:
 *   get:
 *     tags: [Customers]
 *     summary: 매장별 고객 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 고객 목록
 */
router.get('/:storeId', authMiddleware, checkStorePermission('owner'), catchAsync(customerController.getCustomers));

module.exports = router;

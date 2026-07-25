const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const { validateBody, validateId } = require('../middleware/validator');
const pointsController = require('../controllers/pointsController');

/**
 * @swagger
 * tags:
 *   name: Points
 *   description: 포인트 시스템 API (적립, 사용, 설정, 관리)
 */

/**
 * @swagger
 * /api/points/balance:
 *   get:
 *     tags: [Points]
 *     summary: 포인트 잔액 조회 (인증된 사용자 본인만)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 현재 포인트 잔액
 */
router.get('/balance', authMiddleware, pointsController.getBalance);

/**
 * @swagger
 * /api/points/history:
 *   get:
 *     tags: [Points]
 *     summary: 포인트 내역 조회 (인증된 사용자 본인만)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 포인트 적립/사용 내역 목록
 */
router.get('/history', authMiddleware, pointsController.getHistory);

/**
 * @swagger
 * /api/points/wallet-lookup:
 *   get:
 *     tags: [Points]
 *     summary: 월렛 조회
 *     responses:
 *       200:
 *         description: 월렛 정보 조회
 */
router.get('/wallet-lookup', pointsController.walletLookup);

/**
 * @swagger
 * /api/points/calculate-earn:
 *   get:
 *     tags: [Points]
 *     summary: 예상 적립 포인트 계산
 *     parameters:
 *       - in: query
 *         name: store_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 예상 적립 포인트 금액
 */
router.get('/calculate-earn', validateId(['store_id', 'amount']), pointsController.calculateEarnPoints);

/**
 * @swagger
 * /api/points/calculate-usable:
 *   get:
 *     tags: [Points]
 *     summary: 사용 가능 포인트 계산
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 사용 가능 포인트 금액
 */
router.get('/calculate-usable', authMiddleware, validateId(['store_id', 'amount']), pointsController.calculateUsablePoints);

/**
 * @swagger
 * /api/points/settings/{storeId}:
 *   get:
 *     tags: [Points]
 *     summary: 매장 포인트 설정 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 매장별 포인트 적립률 및 등급 설정
 */
router.get('/settings/:storeId', pointsController.getStoreSettings);

/**
 * @swagger
 * /api/points/settings/{storeId}:
 *   put:
 *     tags: [Points]
 *     summary: 매장 포인트 설정 업데이트 (관리자용)
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
 *               earn_rate:
 *                 type: number
 *                 description: "포인트 적립률 (예: 0.01 = 1%)"
 *               use_rate:
 *                 type: number
 *                 description: 포인트 사용률
 *     responses:
 *       200:
 *         description: 설정 업데이트 완료
 */
router.put('/settings/:storeId', authMiddleware, checkStorePermission('store:update'), pointsController.updateStoreSettings);

/**
 * @swagger
 * /api/points/admin/earn:
 *   post:
 *     tags: [Points]
 *     summary: 수동 포인트 적립 (super_admin 또는 admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, amount]
 *             properties:
 *               store_id:
 *                 type: integer
 *               amount:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 포인트 적립 완료
 */
router.post('/admin/earn', authMiddleware, validateBody(['store_id', 'amount']), pointsController.adminEarn);

/**
 * @swagger
 * /api/points/admin/deduct:
 *   post:
 *     tags: [Points]
 *     summary: 수동 포인트 차감 (super_admin 전용)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, amount]
 *             properties:
 *               store_id:
 *                 type: integer
 *               amount:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 포인트 차감 완료
 */
router.post('/admin/deduct', authMiddleware, pointsController.adminDeduct);

module.exports = router;

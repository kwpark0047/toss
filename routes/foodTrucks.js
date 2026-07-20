const express = require('express');
const router = express.Router();
const foodTruckController = require('../controllers/foodTruckController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: FoodTrucks
 *   description: 푸드트럭 실시간 영업 관리 API
 */

/**
 * @swagger
 * /api/food-trucks/active:
 *   get:
 *     tags: [FoodTrucks]
 *     summary: 현재 영업 중인 모든 활성 푸드트럭 지도 조회
 *     responses:
 *       200:
 *         description: 활성 푸드트럭 목록 반환
 */
router.get('/active', foodTruckController.getActiveFoodTrucks);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}:
 *   get:
 *     tags: [FoodTrucks]
 *     summary: 푸드트럭 개별 실시간 상태 조회
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
 *         description: 푸드트럭 상태 반환
 */
router.get('/stores/:storeId', authMiddleware, checkStorePermission('settings:read'), foodTruckController.getFoodTruckStatus);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/gps:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 실시간 GPS 좌표 갱신
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
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       200:
 *         description: GPS 갱신 완료
 */
router.post('/stores/:storeId/gps', authMiddleware, checkStorePermission('settings:update'), foodTruckController.updateLocation);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/session:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 이동식 현장 영업 활성화/종료 세션 전환
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
 *         description: 세션 전환 완료
 */
router.post('/stores/:storeId/session', authMiddleware, checkStorePermission('settings:update'), foodTruckController.toggleSession);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/emergency-soldout:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 긴급 재료소진 비상 마감
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
 *         description: 비상 마감 처리 완료
 */
router.post('/stores/:storeId/emergency-soldout', authMiddleware, checkStorePermission('settings:update'), foodTruckController.toggleEmergencySoldOut);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/ingredient-sold-out:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 개별 재료 소진 처리
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
 *               ingredientId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 재료 소진 처리 완료
 */
router.post('/stores/:storeId/ingredient-sold-out', authMiddleware, checkStorePermission('settings:update'), foodTruckController.ingredientSoldOut);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/flash-sale:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 위치 기반 타임세일 전송
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
 *         description: 타임세일 전송 완료
 */
router.post('/stores/:storeId/flash-sale', authMiddleware, checkStorePermission('settings:update'), foodTruckController.triggerFlashSale);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/offline-sync:
 *   post:
 *     tags: [FoodTrucks]
 *     summary: 오프라인 IndexedDB 동기화 일괄 트랜잭션 수신
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
 *               transactions:
 *                 type: array
 *     responses:
 *       200:
 *         description: 오프라인 동기화 완료
 */
router.post('/stores/:storeId/offline-sync', authMiddleware, checkStorePermission('settings:update'), foodTruckController.processOfflineSync);

/**
 * @swagger
 * /api/food-trucks/stores/{storeId}/analytics:
 *   get:
 *     tags: [FoodTrucks]
 *     summary: 피크타임 및 거점별 판매 통계 분석 보고서 조회
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
 *         description: 분석 보고서 반환
 */
router.get('/stores/:storeId/analytics', authMiddleware, checkStorePermission('settings:read'), foodTruckController.getAnalytics);

module.exports = router;

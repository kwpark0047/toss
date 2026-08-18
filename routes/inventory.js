const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission: checkPermission } = require('../middleware/storeAuth');
const {
  getInventory,
  adjustStock,
  setStock,
  getStockHistory,
  getStoreStockHistory,
  getLowStockAlerts,
} = require('../controllers/inventoryController');
const inventoryReorderController = require('../controllers/inventoryReorderController');

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: 재고 관리 API
 */

/**
 * @swagger
 * /api/inventory/store/{storeId}:
 *   get:
 *     tags: [Inventory]
 *     summary: 매장 재고 현황 목록 조회
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
 *         description: 재고 목록
 */
router.get('/store/:storeId', authMiddleware, checkPermission('menu:read'), getInventory);

/**
 * @swagger
 * /api/inventory/store/{storeId}/history:
 *   get:
 *     tags: [Inventory]
 *     summary: 매장 전체 재고 이력 조회
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
 *         description: 재고 이력
 */
router.get(
  '/store/:storeId/history',
  authMiddleware,
  checkPermission('menu:read'),
  getStoreStockHistory
);

/**
 * @swagger
 * /api/inventory/store/{storeId}/alerts:
 *   get:
 *     tags: [Inventory]
 *     summary: 저재고 알림 조회
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
 *         description: 저재고 알림 목록
 */
router.get(
  '/store/:storeId/alerts',
  authMiddleware,
  checkPermission('menu:read'),
  getLowStockAlerts
);

router.post(
  '/store/:storeId/reorder-candidates/generate',
  authMiddleware,
  checkPermission('items:manage'),
  inventoryReorderController.generate
);
router.get(
  '/store/:storeId/reorder-candidates',
  authMiddleware,
  checkPermission('items:manage'),
  inventoryReorderController.list
);
router.post(
  '/store/:storeId/reorder-candidates/:id/decide',
  authMiddleware,
  checkPermission('items:manage'),
  inventoryReorderController.decide
);

/**
 * @swagger
 * /api/inventory/products/{productId}/stock:
 *   put:
 *     tags: [Inventory]
 *     summary: 상품별 재고 수동 조정 (입출고)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [change, reason]
 *             properties:
 *               change:
 *                 type: integer
 *                 description: "양수=입고, 음수=차감"
 *               reason:
 *                 type: string
 *                 enum: [MANUAL_IN, MANUAL_OUT, CORRECTION, RETURN]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: 재고 조정 완료
 */
router.put(
  '/products/:productId/stock',
  authMiddleware,
  checkPermission('menu:write'),
  adjustStock
);

/**
 * @swagger
 * /api/inventory/products/{productId}/stock/set:
 *   put:
 *     tags: [Inventory]
 *     summary: 재고 절대수치 설정 + 임계값 설정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               quantity:
 *                 type: integer
 *                 description: "설정할 재고 수량 (null=무제한)"
 *               low_stock_threshold:
 *                 type: integer
 *                 description: "저재고 경고 임계치"
 *     responses:
 *       200:
 *         description: 재고 설정 완료
 */
router.put(
  '/products/:productId/stock/set',
  authMiddleware,
  checkPermission('menu:write'),
  setStock
);

/**
 * @swagger
 * /api/inventory/products/{productId}/history:
 *   get:
 *     tags: [Inventory]
 *     summary: 상품별 재고 이력 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 상품 재고 이력
 */
router.get(
  '/products/:productId/history',
  authMiddleware,
  checkPermission('menu:read'),
  getStockHistory
);

module.exports = router;

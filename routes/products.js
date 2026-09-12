const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { validateBody, validateQuery, validateParams } = require('../middleware/validate');
const { checkStorePermissionForObject } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const productsController = require('../controllers/productsController');
const {
  createProductSchema,
  updateProductSchema,
  productSearchQuerySchema,
  productIdParamSchema,
} = require('../src/validation/schemas');

/**
 * @swagger
 * /api/products/store/{storeId}:
 *   get:
 *     tags: [Products]
 *     summary: 매장별 상품 목록 조회 (메뉴판)
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 상품 목록 (60초 캐시)
 */
router.get(
  '/store/:storeId',
  validateParams({ params: productSearchQuerySchema }),
  catchAsync(productsController.getStoreProducts)
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: 상품 상세 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 상품 상세 정보
 */
router.get(
  '/:id',
  validateParams(productIdParamSchema),
  catchAsync(productsController.getProductById)
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: 상품 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductRequest'
 *     responses:
 *       201:
 *         description: 상품 생성 완료
 */
router.post(
  '/',
  authMiddleware,
  validateBody(createProductSchema),
  catchAsync(productsController.createProduct)
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: 상품 정보 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductRequest'
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  validateParams(productIdParamSchema),
  checkStorePermissionForObject('products'),
  validateBody(updateProductSchema),
  catchAsync(productsController.updateProduct)
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: 상품 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  validateParams(productIdParamSchema),
  checkStorePermissionForObject('products'),
  catchAsync(productsController.deleteProduct)
);

/**
 * @swagger
 * /api/products/bulk:
 *   post:
 *     tags: [Products]
 *     summary: 상품 일괄 등록
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_id, products]
 *             properties:
 *               store_id: { type: integer }
 *               products: { type: array, items: { type: object } }
 *     responses:
 *       201:
 *         description: 일괄 등록 완료
 */
router.post('/bulk', authMiddleware, catchAsync(productsController.bulkCreate));

/**
 * @swagger
 * /api/products/import:
 *   post:
 *     tags: [Products]
 *     summary: 다른 매장에서 메뉴 가져오기
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source_store_id, target_store_id]
 *             properties:
 *               source_store_id: { type: integer }
 *               target_store_id: { type: integer }
 *     responses:
 *       200:
 *         description: 가져오기 완료
 */
router.post('/import', authMiddleware, catchAsync(productsController.importFromStore));

module.exports = router;

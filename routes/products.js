const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { product: schema } = require('../utils/validationSchemas');
const productsController = require('../controllers/productsController');

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
 *     responses:
 *       200:
 *         description: 상품 목록 (60초 캐시)
 */
router.get('/store/:storeId', productsController.getStoreProducts);

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
router.get('/:id', productsController.getProductById);

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
 *             type: object
 *             required: [store_id, name, price]
 *             properties:
 *               store_id: { type: integer }
 *               name: { type: string, example: '아메리카노' }
 *               price: { type: integer, example: 4500 }
 *               category: { type: string }
 *               description: { type: string }
 *               image_url: { type: string }
 *     responses:
 *       201:
 *         description: 상품 생성 완료
 */
router.post('/', authMiddleware, validate(schema.create), productsController.createProduct);

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
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put('/:id', authMiddleware, productsController.updateProduct);

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
router.delete('/:id', authMiddleware, productsController.deleteProduct);

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
router.post('/bulk', authMiddleware, productsController.bulkCreate);

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
router.post('/import', authMiddleware, productsController.importFromStore);

module.exports = router;

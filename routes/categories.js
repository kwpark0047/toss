const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  checkStorePermissionForObject,
  checkUniformStoreMutation,
} = require('../middleware/storeAuth');
const categoriesController = require('../controllers/categoriesController');

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: 카테고리 관리 API
 */

/**
 * @swagger
 * /api/categories/store/{storeId}:
 *   get:
 *     tags: [Categories]
 *     summary: 매장별 카테고리 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 매장 카테고리 목록 반환
 */
router.get('/store/:storeId', categoriesController.getStoreCategories);

/**
 * @swagger
 * /api/categories/sort:
 *   put:
 *     tags: [Categories]
 *     summary: 카테고리 일괄 정렬 순서 업데이트
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     sortOrder:
 *                       type: integer
 *     responses:
 *       200:
 *         description: 정렬 순서 업데이트 완료
 */
router.put(
  '/sort',
  authMiddleware,
  checkUniformStoreMutation('categories'),
  categoriesController.updateSortOrders
);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     tags: [Categories]
 *     summary: 카테고리 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, store_id]
 *             properties:
 *               name:
 *                 type: string
 *               store_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: 카테고리 생성 완료
 */
router.post('/', authMiddleware, categoriesController.createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: 카테고리 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 카테고리 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  checkStorePermissionForObject('categories'),
  categoriesController.updateCategory
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: 카테고리 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 카테고리 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  checkStorePermissionForObject('categories'),
  categoriesController.deleteCategory
);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: 전체 카테고리 목록 조회
 *     responses:
 *       200:
 *         description: 전체 카테고리 목록 반환
 */
router.get('/', categoriesController.getAllCategories);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: 카테고리 단일 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 카테고리 상세 반환
 */
router.get('/:id', categoriesController.getCategoryById);

module.exports = router;

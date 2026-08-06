const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const categoriesController = require('../controllers/categoriesController');
const prisma = require('../config/prisma');
const {
  checkResourcePermission,
  getStoreRole,
  rolePermissions,
} = require('../middleware/storeAuth');

const checkCategoryPermission = checkResourcePermission(
  prisma.categories,
  'id',
  'store_id',
  'items:manage'
);

// 카테고리 정렬 시 모든 카테고리가 동일 매장에 속하는지 검증
const checkSortPermission = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }
    if (req.user.role === 'super_admin') {
      return next();
    }

    const orders = req.body.orders;
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: '정렬할 카테고리 목록이 필요합니다.' });
    }

    const categoryIds = orders.map((o) => parseInt(o.id)).filter((id) => !isNaN(id));
    if (categoryIds.length !== orders.length) {
      return res.status(400).json({ error: '유효하지 않은 카테고리 ID가 포함되어 있습니다.' });
    }

    // 요청된 모든 카테고리 조회
    const categories = await prisma.categories.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, store_id: true },
    });

    if (categories.length !== categoryIds.length) {
      return res.status(404).json({ error: '존재하지 않는 카테고리가 있습니다.' });
    }

    // 서로 다른 매장의 카테고리를 섞어 정렬할 수 없음
    const storeIds = [...new Set(categories.map((c) => c.store_id))];
    if (storeIds.length !== 1) {
      return res.status(400).json({ error: '다른 매장의 카테고리는 함께 정렬할 수 없습니다.' });
    }

    // 단일 매장에 대한 권한 확인
    const storeId = storeIds[0];
    const role = await getStoreRole(req.user.id, storeId);
    if (!role) {
      return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
    }
    const permissions = rolePermissions[role] || [];
    if (role === 'owner' || permissions.includes('items:manage')) {
      req.storeId = storeId;
      req.storeRole = role;
      return next();
    }
    return res.status(403).json({ error: '권한이 부족합니다 (items:manage)' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '정렬 권한 검증 중 오류가 발생했습니다.' });
  }
};

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
router.put('/sort', authMiddleware, checkSortPermission, categoriesController.updateSortOrders);

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
router.put('/:id', authMiddleware, checkCategoryPermission, categoriesController.updateCategory);

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
router.delete('/:id', authMiddleware, checkCategoryPermission, categoriesController.deleteCategory);

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

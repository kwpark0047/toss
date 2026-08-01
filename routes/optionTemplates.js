const express = require('express');
const router = express.Router();
const optionTemplatesController = require('../controllers/optionTemplatesController');
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const { checkResourcePermission, checkStorePermission } = require('../middleware/storeAuth');

const checkOptionPermission = checkResourcePermission(
  prisma.option_templates,
  'id',
  'store_id',
  'items:manage'
);

/**
 * @swagger
 * tags:
 *   name: OptionTemplates
 *   description: 메뉴 옵션 템플릿 관리 API
 */

/**
 * @swagger
 * /api/option-templates/store/{storeId}:
 *   get:
 *     tags: [OptionTemplates]
 *     summary: 매장별 옵션 템플릿 목록 조회
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
 *         description: 옵션 템플릿 목록
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('order:read'),
  catchAsync(optionTemplatesController.getTemplates)
);

/**
 * @swagger
 * /api/option-templates:
 *   post:
 *     tags: [OptionTemplates]
 *     summary: 옵션 템플릿 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: 템플릿 생성 완료
 */
router.post('/', authMiddleware, catchAsync(optionTemplatesController.createTemplate));

/**
 * @swagger
 * /api/option-templates/{id}:
 *   put:
 *     tags: [OptionTemplates]
 *     summary: 옵션 템플릿 수정
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
 *     responses:
 *       200:
 *         description: 템플릿 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  checkOptionPermission,
  catchAsync(optionTemplatesController.updateTemplate)
);

/**
 * @swagger
 * /api/option-templates/{id}:
 *   delete:
 *     tags: [OptionTemplates]
 *     summary: 옵션 템플릿 삭제
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
 *         description: 템플릿 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  checkOptionPermission,
  catchAsync(optionTemplatesController.deleteTemplate)
);

module.exports = router;

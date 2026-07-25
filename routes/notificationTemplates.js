const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
} = require('../controllers/notificationTemplatesController');

/**
 * @swagger
 * tags:
 *   name: NotificationTemplates
 *   description: 알림 템플릿 관리 API
 */

/**
 * @swagger
 * /api/notification-templates:
 *   get:
 *     tags: [NotificationTemplates]
 *     summary: 알림 템플릿 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 템플릿 목록
 */
router.get('/', authMiddleware, getTemplates);

/**
 * @swagger
 * /api/notification-templates/{id}:
 *   get:
 *     tags: [NotificationTemplates]
 *     summary: 단일 알림 템플릿 조회
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
 *         description: 템플릿 상세
 */
router.get('/:id', authMiddleware, getTemplate);

/**
 * @swagger
 * /api/notification-templates:
 *   post:
 *     tags: [NotificationTemplates]
 *     summary: 알림 템플릿 생성
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
router.post('/', authMiddleware, createTemplate);

/**
 * @swagger
 * /api/notification-templates/{id}:
 *   put:
 *     tags: [NotificationTemplates]
 *     summary: 알림 템플릿 수정
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
router.put('/:id', authMiddleware, updateTemplate);

/**
 * @swagger
 * /api/notification-templates/{id}:
 *   delete:
 *     tags: [NotificationTemplates]
 *     summary: 알림 템플릿 삭제
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
router.delete('/:id', authMiddleware, deleteTemplate);

module.exports = router;

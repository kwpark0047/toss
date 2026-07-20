const express = require('express');
const router = express.Router();
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    createSystemNotification,
    registerToken
} = require('../controllers/notificationsController');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: 알림 관리 API (FCM 푸시 + 인앱)
 */

/**
 * @swagger
 * /api/notifications/register-token:
 *   post:
 *     tags: [Notifications]
 *     summary: FCM 푸시 토큰 등록
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: 토큰 등록 완료
 */
router.post('/register-token', authMiddleware, registerToken);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: 알림 목록 조회
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
 *         name: unread
 *         schema:
 *           type: boolean
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
 *         description: 알림 목록
 */
router.get('/', authMiddleware, getNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: 읽지 않은 알림 개수 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 읽지 않은 알림 개수
 */
router.get('/unread-count', authMiddleware, getUnreadCount);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: 전체 읽음 처리
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 전체 읽음 처리 완료
 */
router.patch('/read-all', authMiddleware, markAllAsRead);

/**
 * @swagger
 * /api/notifications/clear:
 *   delete:
 *     tags: [Notifications]
 *     summary: 전체 알림 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [read, all]
 *     responses:
 *       200:
 *         description: 전체 삭제 완료
 */
router.delete('/clear', authMiddleware, clearNotifications);

/**
 * @swagger
 * /api/notifications/system:
 *   post:
 *     tags: [Notifications]
 *     summary: 시스템 알림 수동 생성 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               storeId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 시스템 알림 생성 완료
 */
router.post('/system', authMiddleware, createSystemNotification);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: 개별 알림 읽음 처리
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
 *         description: 읽음 처리 완료
 */
router.patch('/:id/read', authMiddleware, markAsRead);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: 개별 알림 삭제
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
 *         description: 삭제 완료
 */
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;


const express = require('express');
const router = express.Router();
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

// FCM 토큰 등록
router.post('/register-token', authMiddleware, registerToken);

// 알림 목록 조회 (?store_id=&type=&unread=true&page=&limit=)
router.get('/', authMiddleware, getNotifications);

// 읽지 않은 알림 수 + 타입별 요약
router.get('/unread-count', authMiddleware, getUnreadCount);

// 전체 읽음 처리 (?store_id=)
router.patch('/read-all', authMiddleware, markAllAsRead);

// 전체 삭제 (?store_id=&mode=read|all)
router.delete('/clear', authMiddleware, clearNotifications);

// 시스템 알림 수동 생성 (super_admin용)
router.post('/system', authMiddleware, createSystemNotification);

// 단일 읽음 처리
router.patch('/:id/read', authMiddleware, markAsRead);

// 단일 삭제
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;

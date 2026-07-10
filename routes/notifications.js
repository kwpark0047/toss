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

// FCM ? í° ?±ë¡
router.post('/register-token', authMiddleware, registerToken);

// ?Œë¦¼ ëª©ë¡ ì¡°íšŒ (?store_id=&type=&unread=true&page=&limit=)
router.get('/', authMiddleware, getNotifications);

// ?½ì? ?Šì? ?Œë¦¼ ??+ ?€?…ë³„ ?”ì•½
router.get('/unread-count', authMiddleware, getUnreadCount);

// ?„ì²´ ?½ìŒ ì²˜ë¦¬ (?store_id=)
router.patch('/read-all', authMiddleware, markAllAsRead);

// ?„ì²´ ?? œ (?store_id=&mode=read|all)
router.delete('/clear', authMiddleware, clearNotifications);

// ?œìŠ¤???Œë¦¼ ?˜ë™ ?ì„± (super_admin??
router.post('/system', authMiddleware, createSystemNotification);

// ?¨ì¼ ?½ìŒ ì²˜ë¦¬
router.patch('/:id/read', authMiddleware, markAsRead);

// ?¨ì¼ ?? œ
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;


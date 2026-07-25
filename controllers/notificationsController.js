const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');

const ALLOWED_TYPES = ['NEW_ORDER', 'ORDER_STATUS', 'LOW_STOCK', 'NEW_REVIEW', 'NEW_RESERVATION', 'NEW_WAITING', 'MANAGER_CALL', 'SETTLEMENT', 'SYSTEM'];

/**
 * 1. 알림 목록 조회
 * GET /api/notifications?store_id=&type=&unread=true&page=1&limit=20
 */
const getNotifications = async (req, res, next) => {
    try {
        const { store_id, type, unread, page = 1, limit = 20 } = req.query;
        if (!store_id) return next(new AppError('store_id가 필요합니다.', 400));

        const where = { store_id: Number(store_id) };
        if (type && ALLOWED_TYPES.includes(type)) where.type = type;
        if (unread === 'true') where.is_read = false;

        const skip = (Number(page) - 1) * Number(limit);

        let total = 0, notifications = [];
        try {
            [total, notifications] = await Promise.all([
                prisma.notifications.count({ where }),
                prisma.notifications.findMany({
                    where,
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: Number(limit)
                })
            ]);
        } catch (dbErr) {
            // notifications 테이블 미반영 시 빈 목록 반환 (500 방지)
            const logger = require('../utils/logger');
            logger.warn('notifications 조회 실패 (스키마 미반영 가능):', dbErr?.message);
        }

        const parsed = notifications.map(n => ({
            ...n,
            data: n.data ? (() => { try { return JSON.parse(n.data); } catch { return null; } })() : null
        }));

        res.success({
            notifications: parsed,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                total_pages: Math.ceil(total / Number(limit))
            }
        }, '알림 목록 조회 완료');
    } catch (err) { next(err); }
};

/**
 * 2. 읽지 않은 알림 수 + 타입별 요약
 * GET /api/notifications/unread-count?store_id=
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const { store_id } = req.query;
        if (!store_id) return next(new AppError('store_id가 필요합니다.', 400));

        let totalUnread = 0, byType = [], urgent = 0;
        try {
            [totalUnread, byType, urgent] = await Promise.all([
                prisma.notifications.count({ where: { store_id: Number(store_id), is_read: false } }),
                prisma.notifications.groupBy({
                    by: ['type'],
                    where: { store_id: Number(store_id), is_read: false },
                    _count: { type: true }
                }),
                prisma.notifications.count({
                    where: { store_id: Number(store_id), is_read: false, priority: 'urgent' }
                })
            ]);
        } catch (dbErr) {
            const logger = require('../utils/logger');
            logger.warn('notifications unread-count 조회 실패 (스키마 미반영 가능):', dbErr?.message);
        }

        const typeMap = Object.fromEntries(byType.map(b => [b.type, b._count.type]));
        res.success({ total_unread: totalUnread, urgent_unread: urgent, by_type: typeMap });
    } catch (err) { next(err); }
};

/**
 * 3. 단일 알림 읽음 처리
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notifications.update({
            where: { id: Number(id) },
            data: { is_read: true }
        });
        res.success(notification, '읽음 처리 완료');
    } catch (err) {
        if (err.code === 'P2025') return next(new AppError('알림을 찾을 수 없습니다.', 404));
        next(err);
    }
};

/**
 * 4. 전체 읽음 처리
 * PATCH /api/notifications/read-all?store_id=
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const { store_id } = req.query;
        if (!store_id) return next(new AppError('store_id가 필요합니다.', 400));

        const { count } = await prisma.notifications.updateMany({
            where: { store_id: Number(store_id), is_read: false },
            data: { is_read: true }
        });
        res.success({ updated: count }, `${count}개 알림을 읽음 처리했습니다.`);
    } catch (err) { next(err); }
};

/**
 * 5. 단일 알림 삭제
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.notifications.delete({ where: { id: Number(id) } });
        res.success({ id: Number(id) }, '알림이 삭제되었습니다.');
    } catch (err) {
        if (err.code === 'P2025') return next(new AppError('알림을 찾을 수 없습니다.', 404));
        next(err);
    }
};

/**
 * 6. 전체 알림 삭제 (읽은 것만 or 전체)
 * DELETE /api/notifications/clear?store_id=&mode=read|all
 */
const clearNotifications = async (req, res, next) => {
    try {
        const { store_id, mode = 'read' } = req.query;
        if (!store_id) return next(new AppError('store_id가 필요합니다.', 400));

        const where = { store_id: Number(store_id) };
        if (mode === 'read') where.is_read = true;

        const { count } = await prisma.notifications.deleteMany({ where });
        res.success({ deleted: count }, `${count}개 알림이 삭제되었습니다.`);
    } catch (err) { next(err); }
};

/**
 * 7. 시스템 알림 수동 생성 (super_admin용)
 * POST /api/notifications/system
 */
const createSystemNotification = async (req, res, next) => {
    try {
        const { store_id, title, message, priority = 'normal', link } = req.body;
        if (!store_id || !title || !message) return next(new AppError('store_id, title, message가 필요합니다.', 400));

        const notificationService = require('../services/notificationService');
        const record = await notificationService.createNotification({
            store_id, type: 'SYSTEM', title, message, priority, link
        });
        res.created(record, '시스템 알림이 발송되었습니다.');
    } catch (err) { next(err); }
};

/**
 * 8. FCM 토큰 등록
 * POST /api/notifications/register-token
 */
const registerToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) return next(new AppError('token이 필요합니다.', 400));
        await prisma.users.update({ where: { id: req.user.id }, data: { fcm_token: token } });
        res.success({ registered: true }, 'FCM 토큰이 등록되었습니다.');
    } catch (err) { next(err); }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    createSystemNotification,
    registerToken
};

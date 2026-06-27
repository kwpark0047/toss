/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket, disconnectSocket, onNotification, onConnect, onDisconnect } from '../utils/socket';
import notificationSound, { vibrateOrderReady, vibrateShort } from '../utils/notificationSound';
import { notificationsAPI } from '../api';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30000; // 30초마다 미수신 알림 보완 폴링

export function NotificationProvider({ children, storeId, userId, role }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [urgentCount, setUrgentCount] = useState(0);
    const [byType, setByType] = useState({});
    const [isConnected, setIsConnected] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
    const [activeFilter, setActiveFilter] = useState('ALL');
    const pollTimer = useRef(null);

    // DB에서 알림 목록 로드
    const fetchNotifications = useCallback(async (page = 1, filter = activeFilter) => {
        if (!storeId) return;
        try {
            setLoading(true);
            const params = { page, limit: 30 };
            if (filter !== 'ALL') params.type = filter;
            const res = await notificationsAPI.getList(storeId, params);
            const data = res.data?.data;
            if (page === 1) {
                setNotifications(data?.notifications || []);
            } else {
                setNotifications(prev => [...prev, ...(data?.notifications || [])]);
            }
            setPagination(data?.pagination || { total: 0, page: 1, total_pages: 1 });
        } catch (_) { /* 조용히 실패 */ }
        finally { setLoading(false); }
    }, [storeId, activeFilter]);

    // 읽지 않은 수 갱신
    const fetchUnreadCount = useCallback(async () => {
        if (!storeId) return;
        try {
            const res = await notificationsAPI.getUnreadCount(storeId);
            const d = res.data?.data;
            setUnreadCount(d?.total_unread || 0);
            setUrgentCount(d?.urgent_unread || 0);
            setByType(d?.by_type || {});
        } catch (_) { /* 조용히 실패 */ }
    }, [storeId]);

    // Socket.IO 실시간 알림 추가
    const addRealtimeNotification = useCallback((notification) => {
        const normalized = {
            ...notification,
            id: notification.id || Date.now(),
            is_read: false,
            created_at: notification.created_at || new Date().toISOString(),
            receivedAt: new Date().toISOString()
        };

        setNotifications(prev => {
            if (prev.find(n => n.id === normalized.id)) return prev;
            return [normalized, ...prev].slice(0, 100);
        });
        setUnreadCount(prev => prev + 1);
        if (normalized.priority === 'urgent') setUrgentCount(prev => prev + 1);

        if (soundEnabled) {
            notificationSound.resume?.();
            if (normalized.type === 'NEW_ORDER' || normalized.type === 'MANAGER_CALL') {
                notificationSound.playNewOrder?.();
                vibrateOrderReady();
            } else if (normalized.type === 'ORDER_STATUS' && normalized.data?.newStatus === 'ready') {
                notificationSound.playOrderReady?.();
                vibrateOrderReady();
            } else {
                notificationSound.playNotification?.();
                vibrateShort();
            }
        }
    }, [soundEnabled]);

    const markAsRead = useCallback(async (id) => {
        try { await notificationsAPI.markAsRead(id); } catch (_) { /* 로컬 업데이트만 */ }
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!storeId) return;
        try { await notificationsAPI.markAllAsRead(storeId); } catch (_) { /* 로컬 업데이트만 */ }
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        setUrgentCount(0);
    }, [storeId]);

    const removeNotification = useCallback(async (id) => {
        const target = notifications.find(n => n.id === id);
        try { await notificationsAPI.delete(id); } catch (_) { /* 로컬 업데이트만 */ }
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (target && !target.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
    }, [notifications]);

    const clearNotifications = useCallback(async (mode = 'read') => {
        if (!storeId) return;
        try { await notificationsAPI.clear(storeId, mode); } catch (_) { /* 로컬 업데이트만 */ }
        if (mode === 'all') {
            setNotifications([]);
            setUnreadCount(0);
            setUrgentCount(0);
        } else {
            setNotifications(prev => prev.filter(n => !n.is_read));
        }
    }, [storeId]);

    const changeFilter = useCallback((filter) => {
        setActiveFilter(filter);
        fetchNotifications(1, filter);
    }, [fetchNotifications]);

    const loadMore = useCallback(() => {
        if (pagination.page < pagination.total_pages) {
            fetchNotifications(pagination.page + 1);
        }
    }, [pagination, fetchNotifications]);

    // 초기 로드 + 30초 폴링
    useEffect(() => {
        if (!storeId) return;
        fetchNotifications(1);
        fetchUnreadCount();
        pollTimer.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
        return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    }, [storeId, fetchNotifications, fetchUnreadCount]);

    // Socket.IO 연결
    useEffect(() => {
        if (!storeId || !userId) return;
        connectSocket(storeId, userId, role);
        const cleanupNotification = onNotification(addRealtimeNotification);
        const cleanupConnect = onConnect(() => setIsConnected(true));
        const cleanupDisconnect = onDisconnect(() => setIsConnected(false));
        return () => {
            cleanupNotification?.();
            cleanupConnect?.();
            cleanupDisconnect?.();
            disconnectSocket();
        };
    }, [storeId, userId, role, addRealtimeNotification]);

    useEffect(() => { notificationSound.setEnabled?.(soundEnabled); }, [soundEnabled]);

    const value = {
        notifications, unreadCount, urgentCount, byType,
        isConnected, soundEnabled, loading, pagination, activeFilter,
        setSoundEnabled, markAsRead, markAllAsRead, removeNotification,
        clearNotifications, changeFilter, loadMore,
        refresh: () => { fetchNotifications(1); fetchUnreadCount(); }
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
}

export default NotificationContext;

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Volume2, VolumeX, Check, Trash2, X, RefreshCw, ChevronDown, Wifi, WifiOff, ShoppingBag, Star, Calendar, AlertTriangle, Phone, Banknote, Settings } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

const TYPE_META = {
    NEW_ORDER:       { icon: ShoppingBag,   color: 'text-orange-400', bg: 'bg-orange-500/10',  label: '새 주문',   dot: 'bg-orange-400' },
    ORDER_STATUS:    { icon: Check,         color: 'text-blue-400',   bg: 'bg-blue-500/10',    label: '주문 상태', dot: 'bg-blue-400' },
    LOW_STOCK:       { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',     label: '재고 경고', dot: 'bg-red-400' },
    NEW_REVIEW:      { icon: Star,          color: 'text-amber-400',  bg: 'bg-amber-500/10',   label: '새 리뷰',   dot: 'bg-amber-400' },
    NEW_RESERVATION: { icon: Calendar,      color: 'text-purple-400', bg: 'bg-purple-500/10',  label: '예약',      dot: 'bg-purple-400' },
    NEW_WAITING:     { icon: Phone,         color: 'text-teal-400',   bg: 'bg-teal-500/10',    label: '대기',      dot: 'bg-teal-400' },
    MANAGER_CALL:    { icon: Phone,         color: 'text-rose-400',   bg: 'bg-rose-500/10',    label: '호출',      dot: 'bg-rose-400' },
    SETTLEMENT:      { icon: Banknote,      color: 'text-green-400',  bg: 'bg-green-500/10',   label: '정산',      dot: 'bg-green-400' },
    SYSTEM:          { icon: Settings,      color: 'text-slate-400',  bg: 'bg-slate-500/10',   label: '시스템',    dot: 'bg-slate-400' },
};

const PRIORITY_BORDER = {
    urgent: 'border-l-4 border-l-red-500',
    high:   'border-l-4 border-l-orange-400',
    normal: '',
    low:    '',
};

const FILTERS = [
    { key: 'ALL',            label: '전체' },
    { key: 'NEW_ORDER',      label: '주문' },
    { key: 'ORDER_STATUS',   label: '상태' },
    { key: 'LOW_STOCK',      label: '재고' },
    { key: 'NEW_REVIEW',     label: '리뷰' },
    { key: 'NEW_RESERVATION',label: '예약' },
    { key: 'MANAGER_CALL',   label: '호출' },
    { key: 'SYSTEM',         label: '시스템' },
];

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000)    return '방금 전';
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function NotificationItem({ notification, onRead, onDelete, onNavigate }) {
    const meta = TYPE_META[notification.type] || TYPE_META.SYSTEM;
    const Icon = meta.icon;
    const isUnread = !notification.is_read;

    const handleClick = () => {
        if (isUnread) onRead(notification.id);
        if (notification.link) onNavigate(notification.link);
    };

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all group
                ${isUnread ? 'bg-white/[0.04]' : 'bg-transparent'}
                ${PRIORITY_BORDER[notification.priority] || ''}
                hover:bg-white/[0.06]`}
            onClick={handleClick}
        >
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg}`}>
                <Icon size={16} className={meta.color} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-bold leading-tight ${isUnread ? 'text-white' : 'text-slate-400'}`}>
                        {notification.title}
                    </p>
                    {isUnread && <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${meta.dot}`} />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                    {notification.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-600">
                        {timeAgo(notification.receivedAt || notification.created_at)}
                    </span>
                    {notification.priority === 'urgent' && (
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase">긴급</span>
                    )}
                    {notification.priority === 'high' && (
                        <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full uppercase">높음</span>
                    )}
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                aria-label="알림 삭제"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-all"
            >
                <X size={12} className="text-slate-500" aria-hidden="true" />
            </button>
        </div>
    );
}

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [showClearMenu, setShowClearMenu] = useState(false);
    const panelRef = useRef(null);
    const navigate = useNavigate();

    const {
        notifications, unreadCount, urgentCount, byType,
        isConnected, soundEnabled, loading, pagination, activeFilter,
        setSoundEnabled, markAsRead, markAllAsRead, removeNotification,
        clearNotifications, changeFilter, loadMore, refresh
    } = useNotifications();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setIsOpen(false);
                setShowClearMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasMore = pagination.page < pagination.total_pages;

    return (
        <div className="relative" ref={panelRef}>
            {/* 벨 버튼 */}
            <button
                onClick={() => { setIsOpen(o => !o); if (!isOpen) refresh(); }}
                aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
                aria-expanded={isOpen}
                className="relative w-12 h-12 flex items-center justify-center bg-white/5 text-slate-400 rounded-2xl border border-white/5 hover:text-orange-400 hover:border-orange-500/30 transition-all"
            >
                <Bell size={20} className={unreadCount > 0 ? 'text-orange-400' : ''} aria-hidden="true" />
                {unreadCount > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center text-white text-[10px] font-black rounded-full px-1 border-2 border-slate-950
                        ${urgentCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {!isConnected && (
                    <span className="absolute bottom-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full" />
                )}
            </button>

            {/* 알림 센터 패널 */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-3 w-96 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl shadow-black/50 z-50 overflow-hidden flex flex-col"
                    style={{ maxHeight: '80vh' }}
                >
                    {/* 헤더 */}
                    <div className="px-5 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <Bell size={16} className="text-orange-400" />
                                <h3 className="font-black text-white text-sm">알림 센터</h3>
                                {unreadCount > 0 && (
                                    <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                                        {unreadCount}개 미확인
                                    </span>
                                )}
                                {urgentCount > 0 && (
                                    <span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full animate-pulse">
                                        긴급 {urgentCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={refresh} aria-label="새로고침" className="p-1.5 rounded-xl hover:bg-white/10 transition-all" title="새로고침">
                                    <RefreshCw size={13} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                                </button>
                                <button onClick={() => setSoundEnabled(s => !s)} aria-label={soundEnabled ? '알림음 끄기' : '알림음 켜기'} className="p-1.5 rounded-xl hover:bg-white/10 transition-all">
                                    {soundEnabled ? <Volume2 size={13} className="text-slate-400" aria-hidden="true" /> : <VolumeX size={13} className="text-slate-500" aria-hidden="true" />}
                                </button>
                                {unreadCount > 0 && (
                                    <button onClick={markAllAsRead} aria-label="전체 읽음" className="p-1.5 rounded-xl hover:bg-white/10 transition-all" title="전체 읽음">
                                        <Check size={13} className="text-slate-400" aria-hidden="true" />
                                    </button>
                                )}
                                <div className="relative">
                                    <button onClick={() => setShowClearMenu(v => !v)} aria-label="알림 정리 메뉴" className="p-1.5 rounded-xl hover:bg-white/10 transition-all">
                                        <Trash2 size={13} className="text-slate-400" aria-hidden="true" />
                                    </button>
                                    {showClearMenu && (
                                        <div className="absolute right-0 top-8 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden w-36">
                                            <button onClick={() => { clearNotifications('read'); setShowClearMenu(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/10 transition-all">
                                                읽은 알림 삭제
                                            </button>
                                            <button onClick={() => { clearNotifications('all'); setShowClearMenu(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-all">
                                                전체 삭제
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 필터 탭 */}
                        <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {FILTERS.map(f => {
                                const count = f.key === 'ALL' ? unreadCount : (byType[f.key] || 0);
                                return (
                                    <button
                                        key={f.key}
                                        onClick={() => changeFilter(f.key)}
                                        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap
                                            ${activeFilter === f.key
                                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                    >
                                        {f.label}
                                        {count > 0 && (
                                            <span className={`text-[9px] font-black px-1 rounded-full
                                                ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 알림 목록 */}
                    <div className="overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                        {loading && notifications.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3">
                                <RefreshCw size={24} className="text-slate-600 animate-spin" />
                                <p className="text-xs text-slate-600 font-bold">불러오는 중...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3">
                                <Bell size={36} className="text-slate-700" />
                                <p className="text-sm font-black text-slate-600">알림이 없습니다</p>
                                <p className="text-[11px] text-slate-700 text-center">새로운 주문·예약·리뷰가 생기면<br />여기에 표시됩니다</p>
                            </div>
                        ) : (
                            <>
                                {notifications.map(n => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onRead={markAsRead}
                                        onDelete={removeNotification}
                                        onNavigate={(link) => { navigate(link); setIsOpen(false); }}
                                    />
                                ))}
                                {hasMore && (
                                    <button
                                        onClick={loadMore}
                                        className="w-full py-3 flex items-center justify-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                                    >
                                        <ChevronDown size={13} />
                                        더 보기 ({pagination.total - notifications.length}개 남음)
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* 푸터 */}
                    <div className={`flex-shrink-0 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black border-t border-white/5
                        ${isConnected ? 'text-emerald-500 bg-emerald-500/5' : 'text-red-500 bg-red-500/5'}`}>
                        {isConnected
                            ? <><Wifi size={10} /> 실시간 연결됨</>
                            : <><WifiOff size={10} /> 연결 끊김 — 재연결 중...</>
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

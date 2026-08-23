import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ordersAPI, getSocket } from '../../api';
import { motion } from 'framer-motion';
import ManagerCallSheet from './ManagerCallSheet';
import ChatDrawer from './ChatDrawer';
import { formatPrice } from '../../utils/format';
import ReviewModal from './ReviewModal';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Icon from "../../ui/Icon";

/**
 * 주문 내역(Order History) 고도화 컴포넌트
 * 고객이 과거에 주문한 내역을 확인하고 실시간 상태를 추적합니다.
 */
const OrderHistory = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // 매니저 호출 관련 상태
    const [showCallSheet, setShowCallSheet] = useState(false);
    const [showChatDrawer, setShowChatDrawer] = useState(false);
    const [activeStore, setActiveStore] = useState(null);

    // 로컬 스토리지에서 사용자 정보 가져오기 (식별용)
    const userPhone = localStorage.getItem('wm_customer_phone') || localStorage.getItem('user_phone');
    const tossUserKey = localStorage.getItem('toss_user_key');

    // 리뷰 모달 관련 상태
    const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
    const [reviewedOrderIds, setReviewedOrderIds] = useState(new Set());

    // 주문 상태별 레이블 및 색상 정의
    const statusConfig = {
        pending: { label: t('status.pending'), color: 'text-orange-600', bg: 'bg-orange-50', icon: "Clock", accent: 'bg-orange-600' },
        confirmed: { label: t('status.confirmed'), color: 'text-blue-600', bg: 'bg-blue-50', icon: "CheckCircle2", accent: 'bg-blue-600' },
        preparing: { label: t('status.preparing'), color: 'text-purple-600', bg: 'bg-purple-50', icon: "UtensilsCrossed", accent: 'bg-purple-600' },
        ready: { label: t('status.ready'), color: 'text-green-600', bg: 'bg-green-50', icon: "PackageCheck", accent: 'bg-green-600' },
        completed: { label: t('status.completed'), color: 'text-slate-600', bg: 'bg-slate-50', icon: "CheckCircle2", accent: 'bg-slate-400' },
        cancelled: { label: t('status.cancelled'), color: 'text-red-600', bg: 'bg-red-50', icon: "XCircle", accent: 'bg-red-600' }
    };

    // 데이터 불러오기 함수
    const fetchHistory = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const historyCapability = localStorage.getItem('wm_customer_history_capability');
            if (!historyCapability || (!userPhone && !tossUserKey)) {
                setOrders([]);
                return;
            }

            const response = await ordersAPI.getCustomerHistory(historyCapability);
            setOrders(response.data);
        } catch (error) {
            console.error('주문 내역 조회 실패:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userPhone, tossUserKey]);

    useEffect(() => {
        fetchHistory();

        // 실시간 업데이트를 위한 소켓 연결 설정
        const socket = getSocket();
        if (socket && orders.length > 0) {
            // 진행 중인 주문들에 대해 룸 참여
            orders.forEach(order => {
                if (!['completed', 'cancelled'].includes(order.status)) {
                    socket.emit('join-order', order.id);
                }
            });

            // 등록한 리스너만 참조로 제거해 다른 컴포넌트의
            // order-updated 리스너까지 삭제하는 것을 방지한다.
            const handleOrderUpdated = (data) => {
                setOrders(prev => prev.map(o =>
                    o.id === data.order_id ? { ...o, status: data.status, status_label: data.status_label } : o
                ));
            };
            socket.on('order-updated', handleOrderUpdated);

            return () => {
                socket.off('order-updated', handleOrderUpdated);
            };
        }
    }, [fetchHistory, orders, userPhone, tossUserKey]);

    const activeOrders = useMemo(() =>
        orders.filter(o => !['completed', 'cancelled'].includes(o.status)),
        [orders]);

    const pastOrders = useMemo(() =>
        orders.filter(o => ['completed', 'cancelled'].includes(o.status)),
        [orders]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-10">
            {/* 헤더 섹션 */}
            <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <Icon icon="ChevronLeft" size="md" className="text-slate-700" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">{t('common.history')}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <button
                            onClick={() => fetchHistory(true)}
                            className={`p-2 rounded-xl transition-all ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <Icon icon="RefreshCw" size="md" className="text-slate-500" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 pt-6 space-y-8">
                {orders.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Icon icon="ShoppingBag" size="md" className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{t('menu.no_items')}</h3>
                        <p className="text-slate-500 mt-2">{t('common.search_placeholder')}</p>
                        <button
                            onClick={() => navigate('/stores')}
                            className="mt-6 px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200"
                        >
                            {t('common.all')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* 진행 중인 주문 섹션 */}
                        {activeOrders.length > 0 && (
                            <section className="space-y-6">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                                            <Icon icon="Clock" size="md" className="text-orange-600" />
                                        </div>
                                        <h2 className="font-black text-slate-800 tracking-tight text-lg">{t('order.active_status')}</h2>
                                    </div>
                                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg shadow-orange-100">
                                        {activeOrders.length}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    {activeOrders.map((order, idx) => {
                                        const config = statusConfig[order.status] || statusConfig.pending;
                                        const StatusIcon = config.icon;

                                        return (
                                            <motion.div
                                                key={order.id}
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="glass-panel p-6 card-hover relative group overflow-hidden"
                                            >
                                                {/* 상태 게이지 바 */}
                                                <div className="absolute top-0 left-0 w-full h-2 bg-slate-50">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: order.status === 'pending' ? '25%' :
                                                                order.status === 'confirmed' ? '50%' :
                                                                    order.status === 'preparing' ? '75%' : '100%'
                                                        }}
                                                        className={`h-full ${config.accent} shadow-sm`}
                                                    />
                                                </div>

                                                <div className="flex justify-between items-start pt-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <h3 className="font-black text-xl text-slate-900 tracking-tight">{order.store_name}</h3>
                                                            <motion.button
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => {
                                                                    setActiveStore({ id: order.store_id, name: order.store_name, phone: order.store_phone });
                                                                    setShowCallSheet(true);
                                                                }}
                                                                className="p-1 px-2 rounded-lg bg-orange-500/10 text-orange-600 text-[10px] font-black border border-orange-500/20 transition-colors flex items-center gap-1"
                                                            >
                                                                <Icon icon="BellRing" size="md" className="animate-pulse" />
                                                                {t('common.call_manager')}
                                                            </motion.button>
                                                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl ${config.bg} ${config.color} font-black text-xs ml-auto`}>
                                                                <StatusIcon size={14} />
                                                                {config.label}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1.5 font-bold">
                                                            <Icon icon="Calendar" size="md" strokeWidth="3" /> {formatDate(order.created_at)}
                                                        </p>
                                                    </div>
                                                    <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                                        <Icon icon="MoreVertical" size="md" />
                                                    </button>
                                                </div>

                                                <div className="mt-6 space-y-3 bg-slate-50/50 rounded-2xl p-4">
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-sm items-center">
                                                            <span className="text-slate-800 font-bold">{item.product_name} <span className="text-slate-400 font-medium ml-1">x {item.quantity}</span></span>
                                                            <span className="text-slate-500 font-mono text-xs">{formatPrice(item.price * item.quantity, true)}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{t('order.total_amount')}</span>
                                                        <span className="font-black text-orange-600 text-2xl tracking-tighter">{formatPrice(order.total_amount, true)}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => navigate(`/menu/${order.store_id}`)}
                                                            className="px-6 py-3 bg-slate-900 text-white text-sm font-black rounded-2xl shadow-xl shadow-slate-200 transition-all flex items-center gap-2 group"
                                                        >
                                                            {t('order.summary')} <Icon icon="ChevronRight" size="md" className="group-hover:translate-x-1 transition-transform" />
                                                        </motion.button>
                                                    </div>
                                                </div>

                                                {/* 실시간 박동 효과 (준비 완료 시) */}
                                                {order.status === 'ready' && (
                                                    <div className="absolute inset-0 border-4 border-green-500/20 rounded-[2rem] animate-pulse pointer-events-none" />
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* 과거 주문 내역 섹션 (Glassmorphism List) */}
                        {pastOrders.length > 0 && (
                            <section className="space-y-6">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                        <Icon icon="PackageCheck" size="md" />
                                    </div>
                                    <h2 className="font-black text-slate-800 tracking-tight text-lg">{t('order.past_history')}</h2>
                                </div>

                                <div className="space-y-3">
                                    {pastOrders.map((order, idx) => (
                                        <motion.div
                                            key={order.id}
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="bg-white/60 backdrop-blur-md rounded-3xl p-5 flex gap-5 items-center border border-white/80 group hover:bg-white transition-all shadow-sm hover:shadow-lg hover:shadow-slate-100 active:scale-[0.98]"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${order.status === 'cancelled' ? 'bg-red-50 text-red-300' : 'bg-slate-100 text-slate-400'}`}>
                                                {order.status === 'cancelled' ? (
                                                    <Icon icon="XCircle" size="md" strokeWidth="1.5" />
                                                ) : (
                                                    <Icon icon="ShoppingBag" size="md" strokeWidth="1.5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-black text-slate-900 truncate tracking-tight">{order.store_name}</h3>
                                                    <span className="text-[10px] font-black text-slate-400 shrink-0 ml-2 uppercase">
                                                        {formatDate(order.created_at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <p className="text-xs text-slate-500 truncate font-medium mr-2">
                                                        {order.items?.[0]?.product_name}
                                                        {order.items?.length > 1 ? <span className="text-slate-300 ml-1">{t('common.and_others', { count: order.items.length - 1 })}</span> : ''}
                                                    </p>
                                                    <span className="text-base font-black text-slate-950 tracking-tighter">{formatPrice(order.total_amount, true)}</span>
                                                </div>
                                                {order.status === 'completed' && (
                                                    <div className="mt-3 flex justify-end gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/menu/${order.store_id}`);
                                                            }}
                                                            className="px-4 py-1.5 rounded-lg text-[10px] font-black transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center gap-1"
                                                        >
                                                            <Icon icon="RefreshCw" size="md" />
                                                            다시 주문하기
                                                        </button>
                                                        <button
                                                            disabled={reviewedOrderIds.has(order.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedOrderForReview(order);
                                                            }}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${reviewedOrderIds.has(order.id)
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-95'
                                                                }`}
                                                        >
                                                            {reviewedOrderIds.has(order.id) ? t('review.completed') : t('review.write')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-1 group-hover:translate-x-1 transition-transform">
                                                <Icon icon="ChevronRight" size="md" className="text-slate-200" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>

            {/* 하단 플로팅 도움말 */}
            <div className="fixed bottom-6 right-6">
                <button
                    onClick={() => {
                        if (activeOrders.length > 0) {
                            setActiveStore({ id: activeOrders[0].store_id, name: activeOrders[0].store_name });
                            setShowCallSheet(true);
                        } else {
                            alert('진행 중인 주문이 있는 매장의 매니저와 소통할 수 있습니다.');
                        }
                    }}
                    className="bg-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center border border-slate-100 ring-4 ring-slate-50"
                >
                    <span className="text-2xl">💬</span>
                </button>
            </div>

            {/* 매니저 호출 시트 및 채팅 드로어 */}
            <ManagerCallSheet
                isOpen={showCallSheet}
                onClose={() => setShowCallSheet(false)}
                store={activeStore}
                onOpenChat={() => setShowChatDrawer(true)}
                onVoiceCall={(type) => {
                    const socket = getSocket();
                    if (socket && activeStore) {
                        socket.emit('manager-call', {
                            storeId: activeStore.id,
                            tableName: '내 주문 내역',
                            type
                        });
                        // 서버 handlers.js의 manager-call 처리 후 manager-call-ack 수신
                        socket.once('manager-call-ack', (ack) => {
                            if (ack?.message) alert(ack.message);
                        });
                    }
                }}
            />

            <ChatDrawer
                isOpen={showChatDrawer}
                onClose={() => setShowChatDrawer(false)}
                store={activeStore}
                customerInfo={{ phone: userPhone }}
            />

            <ReviewModal
                isOpen={!!selectedOrderForReview}
                onClose={() => setSelectedOrderForReview(null)}
                order={selectedOrderForReview}
                onSuccess={() => {
                    if (selectedOrderForReview) {
                        setReviewedOrderIds(prev => new Set([...prev, selectedOrderForReview.id]));
                    }
                }}
            />
        </div>
    );
};

export default OrderHistory;

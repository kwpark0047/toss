import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersAPI, getSocket } from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
    ChefHat, Clock, CheckCircle2, XCircle, RefreshCw,
    UtensilsCrossed, Package, Timer, AlertCircle
} from 'lucide-react';

// 주방 디스플레이 - 터치 최적화, 큰 글씨
const KitchenDisplay = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // 권한 체크
    useEffect(() => {
        if (user && !['super_admin', 'store_admin', 'manager', 'kitchen'].includes(user.role)) {
            navigate('/');
        }
    }, [user, navigate]);

    // 주문 가져오기 (조리중/대기중만)
    const fetchOrders = useCallback(async () => {
        try {
            const res = await ordersAPI.getByStore(storeId);
            // pending, preparing 상태만 표시
            const activeOrders = res.data.filter(
                o => ['pending', 'preparing'].includes(o.status)
            );
            setOrders(activeOrders);
        } catch (error) {
            console.error('주문 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    // 주문 상태 변경
    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            await ordersAPI.updateStatus(orderId, newStatus);
            fetchOrders();
        } catch (error) {
            console.error('상태 변경 실패:', error);
        }
    };

    // 실시간 소켓 연동 고도화
    useEffect(() => {
        fetchOrders();

        const socket = getSocket();
        if (socket) {
            // 주방 룸 조인
            socket.emit('join-kitchen', { storeId });

            // 새 주문 발생 시 처리
            socket.on('new-order', (newOrder) => {
                // 특정 매장의 주문인지 확인 (서버에서 필터링하지만 클라이언트에서도 2차 확인)
                if (newOrder.store_id === parseInt(storeId)) {
                    setOrders(prev => [newOrder, ...prev]);
                    // 알림음 재생 (사용자 상호작용 후 가능)
                    try {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        audio.play();
                    } catch {
                        // 알림음 재생 실패 (브라우저 정책에 의한 사용자 상호작용 필요)
                    }
                }
            });

            // 주문 상태 업데이트 수신
            socket.on('order-updated', (updatedOrder) => {
                setOrders(prev => {
                    // 완료된 주문은 목록에서 제거, 그 외에는 상태 업데이트
                    if (['ready', 'cancelled', 'completed'].includes(updatedOrder.status)) {
                        return prev.filter(o => o.id !== updatedOrder.id);
                    }
                    return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
                });
            });

            return () => {
                socket.off('new-order');
                socket.off('order-updated');
                // 소켓 룸 퇴장은 별도로 처리하거나 연결 해제 시 자동 처리
            };
        }
    }, [fetchOrders, storeId]);

    // 경과 시간 계산
    const getElapsedTime = (createdAt) => {
        const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
        return diff;
    };

    // 상태별 스타일
    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending':
                return 'bg-orange-500/20 border-orange-500 text-orange-400';
            case 'preparing':
                return 'bg-blue-500/20 border-blue-500 text-blue-400';
            default:
                return 'bg-slate-500/20 border-slate-500 text-slate-400';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-2xl text-slate-400 font-bold">주문 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            {/* 헤더 */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-orange-500/20 rounded-2xl">
                        <ChefHat className="w-10 h-10 text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black">주방 디스플레이</h1>
                        <p className="text-slate-500 text-lg">대기 주문: {orders.length}건</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-6 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'
                            }`}
                    >
                        <RefreshCw className={autoRefresh ? 'animate-spin' : ''} size={24} />
                        {autoRefresh ? '자동 갱신 ON' : '자동 갱신 OFF'}
                    </button>
                    <button
                        onClick={fetchOrders}
                        className="px-6 py-4 bg-blue-500 rounded-2xl font-bold text-lg flex items-center gap-3"
                    >
                        <RefreshCw size={24} />
                        새로고침
                    </button>
                </div>
            </header>

            {/* 주문 카드 그리드 */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <UtensilsCrossed className="w-24 h-24 text-slate-700 mb-6" />
                    <p className="text-3xl text-slate-500 font-bold">대기 중인 주문이 없습니다</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {orders.map((order) => {
                        const elapsed = getElapsedTime(order.created_at);
                        const isUrgent = elapsed > 10;

                        return (
                            <div
                                key={order.id}
                                className={`relative p-6 rounded-3xl border-2 transition-all ${getStatusStyle(order.status)} ${isUrgent ? 'animate-pulse' : ''
                                    }`}
                            >
                                {/* 긴급 표시 */}
                                {isUrgent && (
                                    <div className="absolute -top-3 -right-3 p-2 bg-red-500 rounded-full animate-bounce">
                                        <AlertCircle size={24} />
                                    </div>
                                )}

                                {/* 주문 번호 */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-5xl font-black">
                                        #{order.order_number?.slice(-3) || order.id}
                                    </span>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Timer size={20} />
                                        <span className="text-2xl font-bold">{elapsed}분</span>
                                    </div>
                                </div>

                                {/* 테이블/포장 */}
                                <div className="flex items-center gap-2 mb-4">
                                    {order.is_takeout ? (
                                        <span className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl font-bold text-lg">
                                            <Package className="inline mr-2" size={20} />
                                            포장
                                        </span>
                                    ) : (
                                        <span className="px-4 py-2 bg-slate-700 rounded-xl font-bold text-lg">
                                            {order.table_name || `테이블 ${order.table_id}`}
                                        </span>
                                    )}
                                </div>

                                {/* 주문 항목 */}
                                <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                                    {order.items?.map((item, i) => (
                                        <div key={i} className="flex justify-between text-xl">
                                            <span className="font-medium">{item.name}</span>
                                            <span className="font-black text-2xl">×{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* 액션 버튼 */}
                                <div className="grid grid-cols-2 gap-3">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                                            className="col-span-2 py-5 bg-blue-500 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
                                        >
                                            <ChefHat size={28} />
                                            조리 시작
                                        </button>
                                    )}
                                    {order.status === 'preparing' && (
                                        <>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'ready')}
                                                className="py-5 bg-green-500 rounded-2xl font-black text-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                            >
                                                <CheckCircle2 size={24} />
                                                완료
                                            </button>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                                className="py-5 bg-red-500/20 text-red-400 rounded-2xl font-bold text-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                            >
                                                <XCircle size={24} />
                                                취소
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 현재 시각 */}
            <div className="fixed bottom-6 right-6 px-6 py-3 bg-slate-900 rounded-2xl border border-white/10">
                <Clock className="inline mr-2 text-slate-500" size={20} />
                <span className="text-xl font-bold text-slate-400">
                    {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

export default KitchenDisplay;

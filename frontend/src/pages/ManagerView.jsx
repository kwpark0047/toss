import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ordersAPI, storesAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice } from '../utils/format';
import { Users, ShoppingBag, BarChart3, Clock, Settings, ChevronRight, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

// 매니저 뷰 - 주문/직원 관리, 간략 통계
const ManagerView = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // 권한 체크
    useEffect(() => {
        if (user && !['super_admin', 'store_admin', 'manager'].includes(user.role)) {
            navigate('/');
        }
    }, [user, navigate]);

    // 데이터 로딩
    const fetchData = useCallback(async () => {
        try {
            const [storeRes, ordersRes, statsRes] = await Promise.all([
                storesAPI.getById(storeId),
                ordersAPI.getByStore(storeId),
                ordersAPI.getStats(storeId),
            ]);
            setStore(storeRes.data);
            setOrders(ordersRes.data.slice(0, 10));
            setStats(statsRes.data);
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // 상태별 카운트
    const getStatusCounts = () => {
        const counts = { pending: 0, preparing: 0, ready: 0, completed: 0 };
        orders.forEach(o => {
            if (counts[o.status] !== undefined) counts[o.status]++;
        });
        return counts;
    };

    const statusCounts = getStatusCounts();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* 헤더 */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">{store?.name || '매장'}</h1>
                        <p className="text-sm text-slate-500">매니저 대시보드</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            to={`/admin/stores/${storeId}/staff`}
                            className="p-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                            <Users size={20} />
                        </Link>
                        <Link
                            to={`/admin/stores/${storeId}/settings`}
                            className="p-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                            <Settings size={20} />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                                <ShoppingBag size={20} />
                            </div>
                            <span className="text-slate-500 text-sm font-medium">오늘 주문</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900">{stats?.total_orders || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-50 rounded-xl text-green-500">
                                <TrendingUp size={20} />
                            </div>
                            <span className="text-slate-500 text-sm font-medium">오늘 매출</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900">{formatPrice(stats?.total_sales || 0)}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-orange-50 rounded-xl text-orange-500">
                                <Clock size={20} />
                            </div>
                            <span className="text-slate-500 text-sm font-medium">대기 중</span>
                        </div>
                        <p className="text-3xl font-black text-orange-500">{statusCounts.pending}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-50 rounded-xl text-purple-500">
                                <BarChart3 size={20} />
                            </div>
                            <span className="text-slate-500 text-sm font-medium">조리 중</span>
                        </div>
                        <p className="text-3xl font-black text-blue-500">{statusCounts.preparing}</p>
                    </div>
                </div>

                {/* 주문 현황 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">최근 주문</h2>
                        <Link
                            to={`/admin/stores/${storeId}/orders`}
                            className="text-sm text-blue-500 font-medium flex items-center gap-1"
                        >
                            전체보기 <ChevronRight size={16} />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {orders.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <ShoppingBag className="mx-auto mb-4 text-slate-300" size={40} />
                                <p>주문이 없습니다</p>
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                                                order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                                                    order.status === 'ready' ? 'bg-green-100 text-green-600' :
                                                        'bg-slate-100 text-slate-500'
                                            }`}>
                                            #{order.order_number?.slice(-3) || order.id}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">
                                                {order.table_name || `테이블 ${order.table_id}`}
                                                {order.is_takeout && <span className="ml-2 text-purple-500">(포장)</span>}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                {new Date(order.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-slate-900">{formatPrice(order.total_amount)}</span>
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                                                order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                                                    order.status === 'ready' ? 'bg-green-100 text-green-600' :
                                                        order.status === 'completed' ? 'bg-slate-100 text-slate-500' :
                                                            'bg-red-100 text-red-600'
                                            }`}>
                                            {order.status === 'pending' ? '대기' :
                                                order.status === 'preparing' ? '조리중' :
                                                    order.status === 'ready' ? '완료' :
                                                        order.status === 'completed' ? '수령' : '취소'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 빠른 링크 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: '주방 화면', to: `/kitchen/${storeId}`, icon: AlertCircle, color: 'orange' },
                        { label: '직원 관리', to: `/admin/stores/${storeId}/staff`, icon: Users, color: 'blue' },
                        { label: '근무표', to: `/admin/stores/${storeId}/schedules`, icon: Calendar, color: 'teal' },
                        { label: '주문 내역', to: `/admin/stores/${storeId}/orders`, icon: ShoppingBag, color: 'green' },
                        { label: '매출 통계', to: `/admin/stores/${storeId}/stats`, icon: BarChart3, color: 'purple' },
                    ].map((item) => (
                        <Link
                            key={item.label}
                            to={item.to}
                            className={`p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group`}
                        >
                            <div className={`p-3 bg-${item.color}-50 rounded-xl text-${item.color}-500 w-fit mb-4 group-hover:scale-110 transition-transform`}>
                                <item.icon size={24} />
                            </div>
                            <p className="font-bold text-slate-900">{item.label}</p>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default ManagerView;

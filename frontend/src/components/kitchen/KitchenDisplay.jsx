import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ordersAPI, productsAPI } from '../../api';
import { UtensilsCrossed, Clock, CheckCircle, ChefHat, RefreshCw, PackageX, ShoppingBag, ToggleLeft, ToggleRight } from 'lucide-react';

// 주방 디스플레이 컴포넌트 - 실시간 주문 관리 및 재고 관리 화면
const KitchenDisplay = () => {
    const { storeId } = useParams();
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]); // 매장 전체 상품 상태
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('orders'); // 'orders' 또는 'inventory'

    // 주문 데이터 조회 함수
    const fetchOrders = async () => {
        try {
            const response = await ordersAPI.getByStore(storeId, 'pending,preparing');
            setOrders(response.data || response || []);
            setError(null);
        } catch (err) {
            console.error('주문 조회 실패:', err);
            setError('주문을 불러오는데 실패했습니다.');
        }
    };

    // 상품 리스트 조회 함수 (재고 관리용)
    const fetchProducts = async () => {
        try {
            const response = await productsAPI.getByStore(storeId);
            setProducts(response.data || response || []);
        } catch (err) {
            console.error('상품 조회 실패:', err);
        }
    };

    // 주문 상태 업데이트
    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            await ordersAPI.updateStatus(orderId, newStatus);
            fetchOrders(); // 데이터 새로고침
        } catch (err) {
            console.error('상태 업데이트 실패:', err);
        }
    };

    // 품절 상태 토글 함수 [NEW]
    const toggleSoldOut = async (product) => {
        try {
            const newStatus = !product.is_sold_out;
            await productsAPI.update(product.id, { is_sold_out: newStatus });
            // 로컬 상태 즉시 업데이트 (낙관적 UI)
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_sold_out: newStatus } : p));
        } catch (err) {
            console.error('품절 상태 변경 실패:', err);
            alert('상태 변경 중 오류가 발생했습니다.');
        }
    };

    // 초기 로드 및 자동 새로고침
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            await Promise.all([fetchOrders(), fetchProducts()]);
            setLoading(false);
        };
        loadInitialData();

        const interval = setInterval(() => {
            if (viewMode === 'orders') fetchOrders();
        }, 30000); // 30초마다 자동 새로고침

        return () => clearInterval(interval);
    }, [storeId, viewMode]);

    // 상태별 배지 색상
    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800',
            preparing: 'bg-blue-100 text-blue-800',
            ready: 'bg-green-100 text-green-800',
            completed: 'bg-gray-100 text-gray-800'
        };
        return badges[status] || badges.pending;
    };

    // 상태 라벨
    const getStatusLabel = (status) => {
        const labels = {
            pending: '대기중',
            preparing: '조리중',
            ready: '완료',
            completed: '전달됨'
        };
        return labels[status] || status;
    };

    if (loading && orders.length === 0 && products.length === 0) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 p-4 font-sans text-slate-200">
            {/* 상단 네비게이션 및 헤더 */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
                        <ChefHat className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">KDS 주방 시스템</h1>
                        <p className="text-sm text-gray-500 font-medium">실시간 주문 및 재고 통합 관리</p>
                    </div>
                </div>

                <div className="flex items-center bg-gray-800 p-1.5 rounded-xl border border-gray-700">
                    <button
                        onClick={() => setViewMode('orders')}
                        className={`px-6 py-2.5 rounded-lg font-black text-sm transition-all flex items-center gap-2 ${viewMode === 'orders' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <ShoppingBag size={18} /> 주문 현황
                    </button>
                    <button
                        onClick={() => setViewMode('inventory')}
                        className={`px-6 py-2.5 rounded-lg font-black text-sm transition-all flex items-center gap-2 ${viewMode === 'inventory' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <PackageX size={18} /> 재고 관리
                    </button>
                </div>

                <button
                    onClick={() => viewMode === 'orders' ? fetchOrders() : fetchProducts()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-all border border-gray-700 font-bold"
                >
                    <RefreshCw className="w-5 h-5" />
                    새로고침
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 text-red-200 rounded-xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {/* 주문 현황 보기 모드 */}
            {viewMode === 'orders' && (
                <>
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
                            <div className="p-8 bg-gray-900 rounded-full mb-6">
                                <UtensilsCrossed className="w-20 h-20 text-gray-800" />
                            </div>
                            <p className="text-2xl font-black">대기 중인 주문이 없습니다</p>
                            <p className="text-gray-500 mt-2 font-medium">신규 주문이 들어오면 이곳에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-gray-900 rounded-[2rem] p-6 border border-gray-800 shadow-2xl flex flex-col hover:border-blue-500/50 transition-colors"
                                >
                                    {/* 주문 헤더 */}
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                                        <div className="flex flex-col">
                                            <span className="text-blue-500 text-xs font-black uppercase tracking-widest mb-1">Queue ID</span>
                                            <span className="text-2xl font-black text-white">#{order.id}</span>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-xs font-black ring-1 ring-inset ${getStatusBadge(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>

                                    {/* 테이블 정보 */}
                                    <div className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-2xl mb-4">
                                        <div className="p-2 bg-gray-800 rounded-xl text-blue-500">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-bold">Table Location</p>
                                            <p className="text-lg font-black text-gray-200">Table {order.table_number || '-'}</p>
                                        </div>
                                    </div>

                                    {/* 주문 항목 */}
                                    <div className="flex-1 space-y-3 mb-6 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(order.items || []).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-100">{item.name}</span>
                                                    {item.options && <span className="text-[10px] text-gray-500 font-medium">{item.options}</span>}
                                                </div>
                                                <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-black text-sm">
                                                    {item.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 액션 버튼 */}
                                    <div className="pt-4 mt-auto border-t border-gray-800">
                                        {order.status === 'pending' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                className="w-full py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all font-black text-lg shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                            >
                                                조리 시작
                                            </button>
                                        )}
                                        {order.status === 'preparing' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'ready')}
                                                className="w-full py-4 bg-green-600 text-white rounded-2xl hover:bg-green-500 transition-all font-black text-lg shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                                            >
                                                <CheckCircle className="w-6 h-6" />
                                                조리 완료
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* 재고 관리 보기 모드 [NEW] */}
            {viewMode === 'inventory' && (
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((p) => (
                            <div
                                key={p.id}
                                className={`p-6 rounded-[2rem] border transition-all ${p.is_sold_out ? 'bg-gray-900/50 border-gray-800 opacity-60' : 'bg-gray-900 border-gray-800'}`}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-gray-800 text-gray-500 rounded-md text-[10px] font-black uppercase tracking-tighter">Product ID #{p.id}</span>
                                        </div>
                                        <h3 className={`text-xl font-black ${p.is_sold_out ? 'text-gray-500 line-through' : 'text-white'}`}>{p.name}</h3>
                                        <p className="text-gray-500 text-sm font-medium mt-1">조리 예상 {p.cooking_time || 5}분</p>
                                    </div>
                                    <div className="shrink-0 ml-4">
                                        <button
                                            onClick={() => toggleSoldOut(p)}
                                            className="focus:outline-none"
                                        >
                                            {p.is_sold_out ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <ToggleLeft size={48} className="text-gray-700" />
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">OFF</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <ToggleRight size={48} className="text-orange-500" />
                                                    <span className="text-[10px] font-black text-orange-500 uppercase">ON</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-gray-800/50">
                                    <span className="text-sm font-bold text-gray-500">현재 판매 상태</span>
                                    {p.is_sold_out ? (
                                        <div className="flex items-center gap-2 text-red-400">
                                            <PackageX size={16} />
                                            <span className="text-sm font-black italic">SOLD OUT</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-green-400 font-black italic tracking-widest text-sm">
                                            AVAILABLE
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenDisplay;

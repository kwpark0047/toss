import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { storesAPI, ordersAPI, analyticsAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store, ShoppingBag, DollarSign, Clock, Plus,
    ChevronRight, BarChart3, Users, TrendingUp,
    Activity, Zap, Target, ArrowUpRight, ArrowDownRight,
    Sparkles, LayoutDashboard, Settings
} from 'lucide-react';

const MasterDashboard = () => {
    const { user } = useAuth();
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');
    const [comparison, setComparison] = useState(null);
    const [isMultiView, setIsMultiView] = useState(false);
    const [multiStoreStats, setMultiStoreStats] = useState(null);

    // 애니메이션 상수
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
        }
    };

    const fetchStores = useCallback(async () => {
        try {
            const res = user?.role === 'super_admin'
                ? await storesAPI.getAll()
                : await storesAPI.getMy();
            setStores(res.data || []);
            if (res.data && res.data.length > 0) {
                setSelectedStore(res.data[0]);
            }
        } catch (error) {
            console.error('매장 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.role]);

    const fetchStoreData = useCallback(async (storeId) => {
        try {
            const [statsRes, ordersRes, compRes] = await Promise.all([
                ordersAPI.getStats(storeId),
                ordersAPI.getByStore(storeId),
                analyticsAPI.getComparison(storeId, timeRange === 'month' ? 'monthly' : 'weekly')
            ]);
            setStats(statsRes.data);
            setRecentOrders(ordersRes.data.slice(0, 8));
            setComparison(compRes.data);
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
        }
    }, [timeRange]);

    const fetchMultiStoreData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            let start, end;
            if (timeRange === 'today') {
                start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                end = new Date().toISOString();
            } else if (timeRange === 'week') {
                start = new Date(now.setDate(now.getDate() - 7)).toISOString();
                end = new Date().toISOString();
            } else {
                start = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                end = new Date().toISOString();
            }

            const res = await analyticsAPI.getMultiStore({ start_date: start, end_date: end });
            setMultiStoreStats(res.data);
            setStats({
                total_sales: res.data.summary.total_sales,
                total_orders: res.data.summary.total_orders,
                by_status: { completed: res.data.summary.total_orders } // 통합 뷰용 임시 매핑
            });
        } catch (error) {
            console.error('다점포 데이터 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchStores();
    }, [fetchStores]);

    useEffect(() => {
        if (isMultiView) {
            fetchMultiStoreData();
        } else if (selectedStore) {
            fetchStoreData(selectedStore.id);
        }
    }, [isMultiView, selectedStore, fetchStoreData, fetchMultiStoreData]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                />
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 text-slate-500 font-bold tracking-widest uppercase text-xs"
                >
                    Initializing Systems...
                </motion.p>
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, trend, color, bgColor, progress }) => (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            className="glass-panel p-6 card-hover relative overflow-hidden group border-white/40 shadow-sm"
        >
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.05] blur-3xl transition-all group-hover:opacity-[0.15] ${bgColor}`}></div>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${bgColor.replace('bg-', 'bg-opacity-10 bg-')} ${color} shadow-inner`}>
                    <Icon size={24} />
                </div>
                {trend !== undefined && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center text-[10px] font-black px-2.5 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}
                    >
                        {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(trend)}%
                    </motion.div>
                )}
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-900">{value}</h3>

            {progress !== undefined && (
                <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full ${bgColor}`}
                    />
                </div>
            )}
        </motion.div>
    );

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Header Section */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-blue-600 mb-2">
                        <LayoutDashboard size={20} />
                        <span className="text-xs font-black uppercase tracking-widest">Master Overview</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                        Command <span className="text-blue-600">Center</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => setIsMultiView(false)}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg border transition-all ${!isMultiView ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}
                        >
                            SINGLE STORE
                        </button>
                        <button
                            onClick={() => setIsMultiView(true)}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg border transition-all ${isMultiView ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-400 border-slate-200'}`}
                        >
                            ALL STORES OVERVIEW
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white shadow-sm">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['today', 'week', 'month'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-5 py-2 text-xs font-black rounded-lg transition-all ${timeRange === range
                                    ? 'bg-white text-blue-600 shadow-md'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {range === 'today' ? '오늘' : range === 'week' ? '주간' : '월간'}
                            </button>
                        ))}
                    </div>

                    {!isMultiView && (
                        <div className="relative">
                            <select
                                value={selectedStore?.id || ''}
                                onChange={(e) => {
                                    const store = stores.find((s) => s.id === parseInt(e.target.value));
                                    setSelectedStore(store);
                                }}
                                className="pl-5 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-black text-xs uppercase tracking-wider focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer appearance-none min-w-[200px] shadow-sm"
                            >
                                {Array.isArray(stores) && stores.map((store) => (
                                    <option key={store.id} value={store.id}>
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="실시간 총 매출"
                    value={formatPrice(stats?.total_sales || 0)}
                    icon={DollarSign}
                    trend={comparison?.growth?.sales}
                    color="text-blue-600"
                    bgColor="bg-blue-500"
                    progress={100}
                />
                <StatCard
                    title="신규 주문 요청"
                    value={`${stats?.total_orders || 0}건`}
                    icon={ShoppingBag}
                    trend={comparison?.growth?.orders}
                    color="text-indigo-600"
                    bgColor="bg-indigo-500"
                    progress={stats?.total_orders > 0 ? 100 : 0}
                />
                <StatCard
                    title="현재 정산 완료율"
                    value={stats?.total_orders > 0
                        ? `${Math.round(((stats.by_status?.completed || 0) / stats.total_orders) * 100)}%`
                        : '0%'}
                    icon={Target}
                    color="text-amber-600"
                    bgColor="bg-amber-500"
                    progress={stats?.total_orders > 0
                        ? (stats.by_status?.completed || 0) / stats.total_orders * 100
                        : 0}
                />
                <StatCard
                    title="매장 가동 효율"
                    value={stats?.total_orders > 0 ? "High" : "Idle"}
                    icon={Activity}
                    color="text-emerald-600"
                    bgColor="bg-emerald-500"
                    progress={stats?.total_orders > 0 ? 85 : 10}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Live Activity Feed or Multi-Store Performance */}
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black flex items-center gap-3">
                            {isMultiView ? (
                                <>
                                    <TrendingUp className="text-indigo-500" size={24} />
                                    Store Performance Rankings
                                </>
                            ) : (
                                <>
                                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                                    Live Order Feed
                                </>
                            )}
                        </h2>
                        {!isMultiView && (
                            <Link to={`/admin/stores/${selectedStore?.id}/orders`} className="group text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                                View All History <ArrowUpRight size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        )}
                    </div>

                    <div className="glass-panel overflow-hidden border-white/50 shadow-xl relative min-h-[500px]">
                        {!isMultiView && (
                            <div className="absolute top-0 right-0 w-full h-full opacity-[0.02] pointer-events-none overflow-hidden">
                                <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover grayscale" alt="bg" />
                            </div>
                        )}

                        <div className="divide-y divide-slate-100 relative z-10">
                            {isMultiView ? (
                                <div className="p-0">
                                    {multiStoreStats?.stores?.map((s, idx) => (
                                        <div key={s.store_id} className="p-6 flex items-center justify-between hover:bg-white/80 transition-all border-l-4 border-l-transparent hover:border-l-indigo-600">
                                            <div className="flex items-center gap-6">
                                                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-lg">{s.store_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                        Total Orders: {s.total_orders}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-indigo-600">{formatPrice(s.total_sales)}</div>
                                                <div className="mt-2 h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden ml-auto">
                                                    <div
                                                        className="h-full bg-indigo-500"
                                                        style={{ width: `${(s.total_sales / (multiStoreStats.summary.total_sales || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {recentOrders.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="p-32 text-center space-y-6"
                                        >
                                            <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-slate-200 border border-slate-100">
                                                <ShoppingBag size={48} />
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Incoming Stream Empty</p>
                                                <p className="text-slate-300 text-sm">현재 들어오는 주문이 없습니다.</p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        recentOrders.map((order, idx) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-6 flex items-center justify-between hover:bg-white/80 transition-all group border-l-4 border-l-transparent hover:border-l-blue-600"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="relative">
                                                        <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center font-black text-xs shadow-inner transition-all group-hover:scale-105 ${order.status === 'pending' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            #{order.order_number.slice(-3)}
                                                        </div>
                                                        {order.status === 'pending' && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 border-2 border-white rounded-full"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-3 text-lg">
                                                            {order.table_name || 'PICKUP'}
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter">
                                                                {order.customer_name || 'GUEST'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-bold flex items-center gap-2 mt-1">
                                                            <Clock size={12} className="text-slate-300" /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                            <span className="text-blue-600 font-black text-sm">{formatPrice(order.total_amount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <span className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg tracking-widest border transition-all ${order.status === 'pending' ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm' :
                                                        order.status === 'preparing' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                            order.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                'bg-slate-50 text-slate-400 border-slate-100'
                                                        }`}>
                                                        {order.status === 'pending' ? 'WAITING' : order.status.toUpperCase()}
                                                    </span>
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        className="p-3 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                                                    >
                                                        <ChevronRight size={18} />
                                                    </motion.button>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Right Sidebar - Operational Toolkit */}
                <motion.div variants={itemVariants} className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black flex items-center gap-3">
                            <Target className="text-indigo-500" size={24} />
                            Operation Tools
                        </h2>
                        <Settings size={18} className="text-slate-300" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { label: 'Menu Manager', to: 'menu', icon: ShoppingBag, desc: '상품 고도화 및 메뉴판 빌더', gradient: 'from-blue-500 to-blue-600' },
                            { label: 'Visual Table Map', to: 'tables', icon: Store, desc: '실시간 좌석 및 동선 관리', gradient: 'from-indigo-500 to-indigo-600' },
                            { label: 'Human Resources', to: 'staff', icon: Users, desc: '직원 권한 및 근태 레포트', gradient: 'from-purple-500 to-purple-600' },
                            { label: 'Intelligence', to: 'stats', icon: BarChart3, desc: 'AI 기반 매출 예측 분석', gradient: 'from-emerald-500 to-emerald-600' },
                            { label: 'Settlement Hub', to: 'settlements', icon: DollarSign, desc: '정산 및 금융 통계 요약', gradient: 'from-amber-500 to-amber-600' },
                        ].map((tool, idx) => (
                            <motion.div
                                key={tool.to}
                                whileHover={{ scale: 1.03, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Link
                                    to={`/admin/stores/${selectedStore?.id}/${tool.to}`}
                                    className="glass-panel p-5 flex items-center gap-5 transition-all hover:bg-white hover:shadow-xl group relative overflow-hidden border-white/60"
                                >
                                    <div className={`p-3.5 bg-gradient-to-br ${tool.gradient} rounded-2xl text-white shadow-lg group-hover:rotate-6 transition-transform`}>
                                        <tool.icon size={22} />
                                    </div>
                                    <div className="relative z-10 flex-grow">
                                        <div className="font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors uppercase text-xs tracking-tight">{tool.label}</div>
                                        <div className="text-[10px] text-slate-400 font-bold mt-1 leading-snug">{tool.desc}</div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Premium Upgrade Banner */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-slate-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl group border border-white/10"
                    >
                        <div className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity duration-700">
                            <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800" className="w-full h-full object-cover grayscale" alt="premium" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px]" />

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-blue-400 mb-4 animate-pulse">
                                <Sparkles size={20} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Upgrade Available</span>
                            </div>
                            <h4 className="text-2xl font-black mb-3 leading-tight">Premium <br /> Intelligence</h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-8 pr-12">빅데이터를 활용한 고객 방문 시간대 예측 및 인기 메뉴 자동 추천 기능을 사용해 보세요.</p>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl"
                            >
                                Get Started Now
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default MasterDashboard;

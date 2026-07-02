import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storesAPI, ordersAPI, analyticsAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminTheme } from '../../contexts/AdminThemeContext';
import { formatPrice, formatTime } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store, ShoppingBag, DollarSign, Clock, Plus,
    ChevronRight, BarChart3, Users, TrendingUp,
    Activity, Zap, Target, ArrowUpRight, ArrowDownRight,
    Sparkles, LayoutDashboard, Settings
} from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
};

const StatCard = ({ title, value, icon: Icon, trend, color, bgColor, progress }) => {
    const iconBg = bgColor.replace('-500', '-500/15');
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -3, scale: 1.01 }}
            className="bg-slate-800/60 border border-white/8 rounded-2xl p-4 md:p-6 relative overflow-hidden group"
        >
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl transition-opacity duration-500 opacity-[0.08] group-hover:opacity-[0.18] ${bgColor}`} />
            <div className="flex justify-between items-start mb-3 md:mb-4">
                <div className={`p-2.5 rounded-xl ${iconBg} ${color}`}>
                    <Icon size={20} />
                </div>
                {trend !== undefined && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center text-[10px] font-black px-2 py-1 rounded-lg gap-0.5 ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}
                    >
                        {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {Math.abs(trend)}%
                    </motion.div>
                )}
            </div>
            <p className="text-slate-500 text-[10px] md:text-xs font-bold tracking-wider mb-0.5 md:mb-1">{title}</p>
            <h3 className="text-lg md:text-3xl font-black text-white leading-tight tabular-nums">{value}</h3>
            {progress !== undefined && (
                <div className="mt-3 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${bgColor}`}
                    />
                </div>
            )}
        </motion.div>
    );
};

const MasterDashboard = () => {
    const { user, consumeStoresCache } = useAuth();
    const { themeId } = useAdminTheme();
    const isLight = themeId === 'arctic';
    // 라이트 테마(arctic)에서 text-white가 흰 배경에 사라지는 문제 방지
    const tx  = isLight ? 'text-slate-900' : 'text-white';
    const txs = isLight ? 'text-slate-500' : 'text-slate-400';
    const cardBg = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/60 border-white/8';
    const navigate = useNavigate();
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');
    const [comparison, setComparison] = useState(null);
    const [isMultiView, setIsMultiView] = useState(false);
    const [multiStoreStats, setMultiStoreStats] = useState(null);
    const [multiViewLoading, setMultiViewLoading] = useState(false);
    const [multiViewError, setMultiViewError] = useState(false);
    const [dataError, setDataError] = useState(false);

    const fetchStores = useCallback(async () => {
        try {
            const cached = consumeStoresCache?.();
            let storeList;
            if (cached) {
                storeList = cached;
                setStores(storeList);
                if (storeList.length > 0) setSelectedStore(storeList[0]);
                setLoading(false);
                storesAPI.getMy()
                    .then(res => {
                        const fresh = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null);
                        if (fresh !== null) {
                            setStores(fresh);
                            if (fresh.length > 0) setSelectedStore(s => s ?? fresh[0]);
                        }
                    })
                    .catch(() => {});
                return;
            }

            const res = user?.role === 'super_admin'
                ? await storesAPI.getAll()
                : await storesAPI.getMy();
            // null = 파싱 실패(예상치 못한 형식), [] = 확정 빈 배열
            const parsed = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null);
            storeList = parsed ?? [];
            setStores(storeList);
            if (storeList.length > 0) {
                setSelectedStore(storeList[0]);
            } else if (parsed !== null && user?.role !== 'super_admin' && !sessionStorage.getItem('wm_setup_skipped')) {
                // 파싱 성공 후 명시적 빈 배열일 때만 온보딩으로 이동
                navigate('/admin/setup');
            }
        } catch (error) {
            console.error('매장 로딩 실패:', error);
            setDataError(true);
        } finally {
            setLoading(false);
        }
    }, [user?.role, navigate, consumeStoresCache]);

    const handleToolNav = useCallback((toolPath) => {
        const store = selectedStore || stores[0];
        if (store?.id) {
            navigate(`/admin/stores/${store.id}/${toolPath}`);
        } else {
            navigate('/admin/stores/new');
        }
    }, [selectedStore, stores, navigate]);

    const fetchStoreData = useCallback(async (storeId) => {
        setDataError(false);
        const [statsResult, ordersResult, compResult] = await Promise.allSettled([
            ordersAPI.getStats(storeId),
            ordersAPI.getByStore(storeId),
            analyticsAPI.getComparison(storeId, timeRange === 'month' ? 'monthly' : 'weekly')
        ]);
        const anyOk = [statsResult, ordersResult, compResult].some(r => r.status === 'fulfilled');
        if (!anyOk) { setDataError(true); return; }
        if (statsResult.status  === 'fulfilled') setStats(statsResult.value?.data ?? null);
        if (ordersResult.status === 'fulfilled') {
            const od = ordersResult.value?.data;
            setRecentOrders(Array.isArray(od) ? od.slice(0, 8) : []);
        }
        if (compResult.status   === 'fulfilled') setComparison(compResult.value?.data ?? null);
    }, [timeRange]);

    const fetchMultiStoreData = useCallback(async () => {
        setMultiViewLoading(true);
        setMultiViewError(false);
        try {
            const now = new Date();
            let start, end;
            if (timeRange === 'today') {
                start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                end = new Date().toISOString();
            } else if (timeRange === 'week') {
                const w = new Date(now);
                w.setDate(w.getDate() - 7);
                start = w.toISOString();
                end = now.toISOString();
            } else {
                const m = new Date(now);
                m.setMonth(m.getMonth() - 1);
                start = m.toISOString();
                end = now.toISOString();
            }

            const res = await analyticsAPI.getMultiStore({ start_date: start, end_date: end });
            setMultiStoreStats(res.data);
            setStats({
                total_sales: res.data?.summary?.total_sales ?? 0,
                total_orders: res.data?.summary?.total_orders ?? 0,
                by_status: { completed: res.data?.summary?.total_orders ?? 0 }
            });
        } catch (error) {
            console.error('다점포 데이터 로딩 실패:', error);
            setMultiViewError(true);
        } finally {
            setMultiViewLoading(false);
        }
    }, [timeRange]);

    useEffect(() => { fetchStores(); }, [fetchStores]);

    useEffect(() => {
        if (isMultiView) {
            fetchMultiStoreData();
        } else if (selectedStore) {
            fetchStoreData(selectedStore.id);
        }
    }, [isMultiView, selectedStore, fetchStoreData, fetchMultiStoreData]);

    if (!loading && dataError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5">
                <div className="text-4xl">⚠️</div>
                <div className="text-center space-y-1">
                    <p className={`${tx} font-black text-lg`}>데이터를 불러오지 못했습니다</p>
                    <p className={`${txs} text-sm`}>서버가 응답하지 않거나 권한이 없습니다.</p>
                </div>
                <button
                    onClick={() => selectedStore && fetchStoreData(selectedStore.id)}
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-all"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    if (loading) {
        const sk1 = isLight ? 'bg-slate-200' : 'bg-white/10';
        const sk2 = isLight ? 'bg-slate-100' : 'bg-white/5';
        const skCard = isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/60 border-white/8';
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className={`h-7 w-48 ${sk1} rounded-xl animate-pulse`} />
                        <div className={`h-4 w-32 ${sk2} rounded-lg animate-pulse`} />
                    </div>
                    <div className={`h-10 w-32 ${sk1} rounded-xl animate-pulse`} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`${skCard} rounded-2xl p-5 border space-y-3`}>
                            <div className={`h-4 w-20 ${sk1} rounded animate-pulse`} />
                            <div className={`h-8 w-28 ${sk1} rounded-xl animate-pulse`} />
                            <div className={`h-3 w-16 ${sk2} rounded animate-pulse`} />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className={`lg:col-span-2 ${skCard} rounded-2xl p-5 border h-64 animate-pulse`} />
                    <div className={`${skCard} rounded-2xl p-5 border space-y-3`}>
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${sk1} animate-pulse flex-shrink-0`} />
                                <div className="flex-1 space-y-1.5">
                                    <div className={`h-3 w-full ${sk1} rounded animate-pulse`} />
                                    <div className={`h-3 w-2/3 ${sk2} rounded animate-pulse`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        );
    }

    if (!loading && stores.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="w-24 h-24 rounded-3xl bg-orange-500/10 border-2 border-orange-500/20 flex items-center justify-center text-4xl">
                    🏪
                </div>
                <div className="text-center space-y-2">
                    <h2 className={`text-2xl font-black ${tx}`}>등록된 매장이 없습니다</h2>
                    <p className={`${txs} text-sm max-w-xs`}>매장을 먼저 생성해야 상품 관리와 메뉴 빌더를 사용할 수 있습니다.</p>
                </div>
                <button
                    onClick={() => navigate('/admin/stores/new')}
                    className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all hover:shadow-lg hover:shadow-orange-500/20 flex items-center gap-2"
                >
                    <Plus size={20} />
                    첫 매장 만들기
                </button>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5 lg:space-y-8"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-orange-500 mb-1.5">
                        <LayoutDashboard size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">전체 현황</span>
                    </div>
                    <h1 className={`text-3xl md:text-5xl font-black ${tx} tracking-tight leading-none`}>
                        운영 <span className="text-orange-500">대시보드</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => setIsMultiView(false)}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${!isMultiView ? 'bg-orange-500 text-white border-orange-500' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'}`}
                        >
                            단일 매장
                        </button>
                        <button
                            onClick={() => setIsMultiView(true)}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isMultiView ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'}`}
                        >
                            전체 매장 통계
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        {['today', 'week', 'month'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 md:px-5 py-2 text-xs font-black rounded-lg transition-all ${timeRange === range
                                    ? (isLight ? 'bg-slate-200 text-slate-800 shadow-sm' : 'bg-white/15 text-white shadow-sm')
                                    : (isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200')
                                    }`}
                            >
                                {range === 'today' ? '오늘' : range === 'week' ? '주간' : '월간'}
                            </button>
                        ))}
                    </div>

                    {!isMultiView && (
                        <div className="relative flex-1 min-w-[140px]">
                            <select
                                value={selectedStore?.id || ''}
                                onChange={(e) => {
                                    const store = stores.find((s) => s.id === parseInt(e.target.value));
                                    setSelectedStore(store);
                                }}
                                className={`w-full pl-4 pr-8 py-2.5 border rounded-xl font-black text-xs outline-none transition-all cursor-pointer appearance-none focus:border-orange-500/50 ${isLight ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300' : 'bg-white/5 border-white/10 text-white hover:border-white/20'}`}
                            >
                                {Array.isArray(stores) && stores.map((store) => (
                                    <option key={store.id} value={store.id} className="bg-slate-900 text-white">
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={14} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                <StatCard
                    title="총 매출"
                    value={formatPrice(stats?.total_sales || 0)}
                    icon={DollarSign}
                    trend={comparison?.growth?.sales}
                    color="text-orange-400"
                    bgColor="bg-orange-500"
                    progress={100}
                />
                <StatCard
                    title="총 주문 수"
                    value={`${stats?.total_orders || 0}건`}
                    icon={ShoppingBag}
                    trend={comparison?.growth?.orders}
                    color="text-indigo-400"
                    bgColor="bg-indigo-500"
                    progress={stats?.total_orders > 0 ? 100 : 0}
                />
                <StatCard
                    title="완료율"
                    value={stats?.total_orders > 0
                        ? `${Math.round(((stats.by_status?.completed || 0) / stats.total_orders) * 100)}%`
                        : '0%'}
                    icon={Target}
                    color="text-amber-400"
                    bgColor="bg-amber-500"
                    progress={stats?.total_orders > 0
                        ? (stats.by_status?.completed || 0) / stats.total_orders * 100
                        : 0}
                />
                <StatCard
                    title="매장 상태"
                    value={stats?.total_orders > 0 ? "활성" : "대기"}
                    icon={Activity}
                    color="text-emerald-400"
                    bgColor="bg-emerald-500"
                    progress={stats?.total_orders > 0 ? 85 : 10}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                {/* Live Orders / Multi-Store */}
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className={`text-lg font-black ${tx} flex items-center gap-3`}>
                            {isMultiView ? (
                                <>
                                    <TrendingUp className="text-indigo-400" size={20} />
                                    매장별 실적 순위
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                                    </span>
                                    실시간 주문
                                </>
                            )}
                        </h2>
                        {!isMultiView && (
                            <Link to={`/admin/stores/${selectedStore?.id}/orders`} className="group text-[10px] font-black text-orange-400 flex items-center gap-1 hover:text-orange-300 transition-colors">
                                전체 내역 <ArrowUpRight size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        )}
                    </div>

                    <div className="bg-slate-800/60 border border-white/8 rounded-2xl overflow-hidden relative min-h-[200px] lg:min-h-[480px]">
                        <div className="divide-y divide-white/5 relative z-10">
                            {isMultiView ? (
                                <div>
                                    {multiViewLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
                                            />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                전체 매장 데이터 집계 중...
                                            </p>
                                        </div>
                                    ) : multiViewError ? (
                                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                                            <div className="text-3xl">⚠️</div>
                                            <p className="text-xs font-bold text-slate-400">데이터를 불러오지 못했습니다</p>
                                            <button
                                                onClick={fetchMultiStoreData}
                                                className="mt-2 px-4 py-2 text-xs font-black text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 transition-colors"
                                            >
                                                다시 시도
                                            </button>
                                        </div>
                                    ) : multiStoreStats?.stores?.length > 0 ? (
                                        multiStoreStats.stores.map((s, idx) => (
                                            <div key={s.store_id} className="p-5 flex items-center justify-between hover:bg-white/4 transition-all border-l-4 border-l-transparent hover:border-l-indigo-500">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-10 h-10 bg-slate-700 text-white rounded-xl flex items-center justify-center font-black text-sm border border-white/10">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-white">{s.store_name}</div>
                                                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">총 {s.total_orders}건</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-black text-indigo-400">{formatPrice(s.total_sales)}</div>
                                                    <div className="mt-2 h-1.5 w-32 bg-white/10 rounded-full overflow-hidden ml-auto">
                                                        <div
                                                            className="h-full bg-indigo-500"
                                                            style={{ width: `${(s.total_sales / (multiStoreStats.summary?.total_sales || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                                            <Store size={40} className="text-slate-700" />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">해당 기간 집계 데이터 없음</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {recentOrders.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="py-24 text-center space-y-5 px-8"
                                        >
                                            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto border border-orange-500/20">
                                                <ShoppingBag size={36} className="text-orange-400" />
                                            </div>
                                            <div>
                                                <p className={`${tx} font-black text-base mb-1`}>아직 주문이 없습니다</p>
                                                <p className="text-slate-500 text-sm">QR 스캔 후 고객이 주문하면 여기에 표시됩니다.</p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        recentOrders.map((order, idx) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, x: -16 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                                                className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between hover:bg-white/4 transition-all group border-l-4 border-l-transparent hover:border-l-orange-500"
                                            >
                                                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                    <div className="relative flex-shrink-0">
                                                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black text-[10px] md:text-xs transition-all group-hover:scale-105 ${
                                                            order.status === 'pending' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-white/10 text-slate-400'
                                                        }`}>
                                                            #{order.order_number.slice(-3)}
                                                        </div>
                                                        {order.status === 'pending' && (
                                                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 border-2 border-slate-900" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`font-black ${tx} group-hover:text-orange-400 transition-colors flex items-center gap-2 text-sm truncate`}>
                                                            {order.table_name || '포장'}
                                                            <span className="text-[9px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
                                                                {order.customer_name || '비회원'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                                                            <Clock size={10} className="flex-shrink-0" />
                                                            {formatTime(order.created_at)}
                                                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                                                            <span className="text-orange-400 font-black text-xs">{formatPrice(order.total_amount)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`hidden sm:flex px-2 md:px-3 py-1 text-[10px] font-black rounded-lg border ${
                                                        order.status === 'pending'   ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        order.status === 'preparing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                                       'bg-white/5 text-slate-500 border-white/10'
                                                    }`}>
                                                        {order.status === 'pending' ? '접수' : order.status === 'preparing' ? '조리중' : order.status === 'completed' ? '완료' : '취소'}
                                                    </span>
                                                    <Link to={`/admin/stores/${selectedStore?.id}/orders`}>
                                                        <motion.div
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            className="p-2 bg-white/5 text-slate-500 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-all"
                                                        >
                                                            <ChevronRight size={14} />
                                                        </motion.div>
                                                    </Link>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Right: Operational Toolkit */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h2 className={`text-lg font-black ${tx} flex items-center gap-3`}>
                            <Zap className="text-orange-500" size={20} />
                            운영 도구
                        </h2>
                        <Settings size={16} className="text-slate-600" />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                        {[
                            { label: '메뉴 관리',  to: 'menu',        icon: ShoppingBag, desc: '상품 등록 및 메뉴판 빌더',   gradient: 'from-blue-500 to-blue-600' },
                            { label: '좌석 관리',  to: 'tables',      icon: Store,       desc: '실시간 좌석 및 동선 관리', gradient: 'from-indigo-500 to-indigo-600' },
                            { label: '직원 관리',  to: 'staff',       icon: Users,       desc: '직원 권한 및 근태 관리',   gradient: 'from-purple-500 to-purple-600' },
                            { label: '매출 분석',  to: 'stats',       icon: BarChart3,   desc: 'AI 기반 매출 예측 분석',   gradient: 'from-emerald-500 to-emerald-600' },
                            { label: '정산 관리',  to: 'settlements', icon: DollarSign,  desc: '정산 및 금융 통계 요약',   gradient: 'from-amber-500 to-amber-600' },
                        ].map((tool) => (
                            <motion.div key={tool.to} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                <button
                                    onClick={() => handleToolNav(tool.to)}
                                    className="w-full bg-slate-800/60 border border-white/8 rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 transition-all hover:bg-slate-700/60 hover:border-white/15 group"
                                >
                                    <div className={`p-2.5 bg-gradient-to-br ${tool.gradient} rounded-xl text-white shadow-md group-hover:scale-110 transition-transform flex-shrink-0`}>
                                        <tool.icon size={18} />
                                    </div>
                                    <div className="flex-grow text-left min-w-0">
                                        <div className={`font-black ${tx} group-hover:text-orange-400 transition-colors text-sm truncate`}>{tool.label}</div>
                                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:block">{tool.desc}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all flex-shrink-0 hidden md:block" />
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* 프리미엄 배너 */}
                    <motion.div
                        whileHover={{ y: -4 }}
                        className="rounded-3xl p-6 text-white relative overflow-hidden border border-white/10"
                        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
                    >
                        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-20 blur-2xl"
                            style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
                        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-15 blur-2xl"
                            style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                                    <Sparkles size={15} className="text-indigo-400" />
                                </div>
                                <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">프리미엄</span>
                            </div>
                            <h4 className="text-xl font-black mb-2 leading-tight">AI 매출 예측<br />
                                <span className="text-indigo-400">인사이트</span>
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                                고객 방문 패턴 분석, 인기 메뉴 자동 추천, 피크타임 예측으로 매출을 극대화하세요.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-500/30"
                            >
                                지금 시작하기
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default MasterDashboard;

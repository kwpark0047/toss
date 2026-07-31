import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router';
import { storesAPI, ordersAPI, analyticsAPI, reviewsAPI, exportAPI, getSocket } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { useSEO } from '../../lib/useSEO';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatPrice, formatTime } from '../../utils/format';
import { format } from 'date-fns';
import EmptyState from '../common/EmptyState';
import Skeleton from '../common/Skeleton';

/* ─── 차트 로딩 스켈레톤 ─── */
const SkeletonChart = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 animate-pulse">
        <div className="h-[170px] w-full" />
    </div>
);
const SkeletonDonut = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 animate-pulse">
        <div className="h-[140px] w-full" />
    </div>
);
import SuperAdminDashboard from './SuperAdminDashboard';
import SystemStatusWidget from './SystemStatusWidget';
import Button from '../common/Button';
import notificationSound from '../../utils/notificationSound';
import { onNewOrder, onOrderUpdated } from '../../utils/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, ShoppingBag, DollarSign, Clock, Plus, ChevronRight, BarChart3, Users, 
  TrendingUp, Activity, Zap, ArrowUpRight, ArrowDownRight, Sparkles, Settings, 
  RefreshCw, Bell, QrCode, LayoutGrid, Home, ReceiptText, BadgeCheck, ChefHat, 
  AlertCircle, CalendarDays, Download, FileSpreadsheet, FileText, Loader2, 
  MessageSquareText, Code2, Handshake, X, Volume2, VolumeX, ShieldAlert
} from 'lucide-react';
/* ─── 차트 컴포넌트 Lazy Loading (초기 번들 및 FCP 최적화) ─── */
const SalesTrendChart = lazy(() => import('./dashboard/DashboardCharts').then(m => ({ default: m.SalesTrendChart })));
const OrderStatusDonut = lazy(() => import('./dashboard/DashboardCharts').then(m => ({ default: m.OrderStatusDonut })));
const PeakHoursBar = lazy(() => import('./dashboard/DashboardCharts').then(m => ({ default: m.PeakHoursBar })));
const SalesForecastWidget = lazy(() => import('./dashboard/DashboardCharts').then(m => ({ default: m.SalesForecastWidget })));

/* ─── 내보내기 패널 ─── */
const ExportPanel = ({ storeId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState(thirtyDaysAgo);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');

    const run = async (label, fn) => {
        setLoading(label);
        setError('');
        try { await fn(); }
        catch (e) { setError(e.message || '다운로드 실패'); }
        finally { setLoading(''); }
    };

    const buttons = [
        { label: '매출 통계', icon: FileSpreadsheet, color: 'from-emerald-500 to-teal-500', fn: () => exportAPI.salesExcel(storeId, startDate, endDate) },
        { label: '주문 내역', icon: FileSpreadsheet, color: 'from-blue-500 to-cyan-500',    fn: () => exportAPI.ordersExcel(storeId, startDate, endDate) },
        { label: '고객 리스트', icon: FileSpreadsheet, color: 'from-violet-500 to-purple-500', fn: () => exportAPI.customersExcel(storeId) },
        { label: '메뉴 분석', icon: FileSpreadsheet, color: 'from-amber-500 to-orange-500', fn: () => exportAPI.menuExcel(storeId, startDate, endDate) },
        { label: 'PDF 보고서', icon: FileText,        color: 'from-rose-500 to-pink-500',   fn: () => exportAPI.reportPdf(storeId, startDate, endDate) },
    ];

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <Download size={15} className="text-blue-400" />
                <h2 className="text-sm font-black text-white">데이터 내보내기</h2>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <input type="date" aria-label="조회 시작일" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="flex-1 text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-300 outline-none" />
                    <span className="text-slate-600 text-xs">~</span>
                    <input type="date" aria-label="조회 종료일" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="flex-1 text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-300 outline-none" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {buttons.map(({ label, icon: Icon, color, fn }) => (
                        <button key={label} onClick={() => run(label, fn)} disabled={!!loading}
                            className="flex flex-col items-center gap-1.5 p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 active:scale-95">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                                {loading === label
                                    ? <Loader2 size={13} className="text-white animate-spin" />
                                    : <Icon size={13} className="text-white" />}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 text-center leading-tight">{label}</span>
                        </button>
                    ))}
                </div>
                {error && <p className="text-[11px] text-rose-400 font-bold">{error}</p>}
            </div>
        </div>
    );
};

const formatCompactPrice = (price) => {
    if (price >= 100000000) return (price / 100000000).toFixed(1) + '억';
    if (price >= 10000) return (price / 10000).toFixed(0) + '만원';
    return formatPrice(price);
};

/* ─── 인기 메뉴 TOP5 ─── */
const TopProductsList = ({ storeId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!storeId) return;
        setLoading(true);
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        analyticsAPI.getProducts(storeId, start, end, 5, 'quantity')
            .then(res => {
                const items = res?.data ?? res ?? [];
                setData(Array.isArray(items) ? items.slice(0, 5) : []);
            })
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [storeId]);

    if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
    if (!data || data.length === 0) return null;

    const maxQty = Math.max(...data.map(d => d.quantity || d.total_quantity || 1), 1);

    return (
        <div>
            <h3 className="text-xs font-black text-white flex items-center gap-1.5 mb-2 px-1">
                <ChefHat size={13} className="text-blue-400" /> 인기 메뉴 TOP5
            </h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-3">
                {data.map((item, idx) => {
                    const qty = item.quantity || item.total_quantity || 0;
                    return (
                        <div key={item.id || idx}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[9px] ${idx < 3 ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-200 truncate">{item.name}</span>
                                </div>
                                <span className="text-[11px] font-black text-white tabular-nums shrink-0 ml-2">{qty}개</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${(qty / maxQty) * 100}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ─── 주문 상태 분포 ─── */
/* ─── 최근 리뷰 피드 ─── */
const RecentReviewsFeed = ({ storeId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!storeId) return;
        setLoading(true);
        reviewsAPI.getStoreReviews(storeId)
            .then(res => {
                const reviews = res?.data ?? res ?? [];
                setData(Array.isArray(reviews) ? reviews.slice(0, 5) : []);
            })
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [storeId]);

    if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
    if (!data || data.length === 0) return null;

    const renderStars = (rating) => {
        const r = Math.round(rating || 5);
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < r ? 'text-amber-400' : 'text-slate-700'} style={{ fontSize: 9 }}>★</span>
        ));
    };

    return (
        <div>
            <h3 className="text-xs font-black text-white flex items-center gap-1.5 mb-2 px-1">
                <MessageSquareText size={13} className="text-fuchsia-400" /> 최근 리뷰
            </h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/5">
                {data.map((review, idx) => (
                    <div key={review.id || idx} className="p-3 first:rounded-t-2xl last:rounded-b-2xl">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-300">{review.author || review.customer_name || '익명'}</span>
                                <div className="flex items-center gap-0.5">{renderStars(review.rating || review.score || 5)}</div>
                            </div>
                            <span className="text-[8px] text-slate-600 font-bold">{review.created_at ? new Date(review.created_at).toLocaleDateString('ko-KR') : ''}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{review.content || review.review || review.comment || ''}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── 날짜 포맷 ─── */
const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6)  return '야간 영업 중이시군요';
    if (h < 11) return '좋은 아침이에요';
    if (h < 14) return '점심 영업 중이에요';
    if (h < 18) return '오후 영업 잘 되고 있나요';
    return '저녁 영업 파이팅이에요';
};
const getTodayStr = () => {
    const d = new Date();
    return `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
};

/* ─── 상태 배지 ─── */
const StatusBadge = ({ status }) => {
    const cfg = {
        paid:      { label: '신규',  cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
        pending:   { label: '접수',  cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
        confirmed: { label: '확인',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
        preparing: { label: '조리중', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
        ready:     { label: '준비완료', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        completed: { label: '완료',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
        cancelled: { label: '취소',  cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    };
    const c = cfg[status] ?? { label: status || '-', cls: 'bg-white/10 text-slate-400 border-white/20' };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${c.cls}`}>{c.label}</span>
    );
};

const MasterDashboard = () => {
    const { user } = useAuth();
    const { stores, selectedStore, loading: storesLoading, changeStore, refetch: refetchStores } = useStore();
    const navigate  = useNavigate();
    const { notifications, markAsRead, soundEnabled, _setSoundEnabled } = useNotifications();

    useSEO({
        title: selectedStore ? `${selectedStore.name} | 위마켓 매장 관리` : '위마켓 매장 관리',
        description: selectedStore ? `${selectedStore.name}의 매출, 주문, 고객 정보를 관리하세요.` : '위마켓 스마트 매장 관리',
    });

    // 실시간으로 수신된 읽지 않은 직원 호출 알림만 집계/정량화 가동
    const activeCalls = useMemo(() => {
        return notifications.filter(n => n.type === 'MANAGER_CALL' && !n.is_read);
    }, [notifications]);

    const [stats,           setStats]           = useState(null);
    const [recentOrders,    setRecentOrders]    = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [timeRange,       setTimeRange]       = useState('today');
    const [comparison,      setComparison]      = useState(null);
    const [isMultiView,     setIsMultiView]     = useState(false);
    const [multiStoreStats, setMultiStoreStats] = useState(null);
    const [multiViewLoading,setMultiViewLoading]= useState(false);
    const [multiViewError,  setMultiViewError]  = useState(false);
    const [refreshing,      setRefreshing]      = useState(false);
    const [lastRefresh,     setLastRefresh]     = useState(new Date());
    const refreshTimer = useRef(null);

    // AI 결제량 변동성 실시간 위기경보 상태
    const [anomalyAlert, setAnomalyAlert] = useState(null);

    /* ─── 매장 로딩 (StoreContext에서 관리) ─── */
    useEffect(() => {
        if (!storesLoading) {
            setLoading(false);
        }
    }, [storesLoading]);

    /* ─── 단일 매장 데이터 ─── */
    const fetchStoreData = useCallback(async (storeId, silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const [sRes, oRes, cRes] = await Promise.allSettled([
                ordersAPI.getStats(storeId),
                ordersAPI.getByStore(storeId, undefined, format(new Date(), 'yyyy-MM-dd')),
                analyticsAPI.getComparison(storeId, timeRange === 'month' ? 'monthly' : 'weekly'),
            ]);
            if (sRes.status === 'fulfilled') setStats(sRes.value?.data ?? sRes.value);
            if (oRes.status === 'fulfilled') {
                const o = oRes.value?.data ?? oRes.value;
                setRecentOrders(Array.isArray(o) ? o.slice(0, 10) : []);
            }
            if (cRes.status === 'fulfilled') setComparison(cRes.value?.data ?? cRes.value);
            setLastRefresh(new Date());
        } catch (e) {
            console.error('데이터 로딩 실패:', e);
        } finally {
            setRefreshing(false);
        }
    }, [timeRange]);

    /* ─── 다점포 데이터 ─── */
    const fetchMultiStoreData = useCallback(async () => {
        setMultiViewLoading(true); setMultiViewError(false);
        try {
            const now = new Date();
            let start; const end = now.toISOString();
            if (timeRange === 'today') { const d = new Date(now); d.setHours(0,0,0,0); start = d.toISOString(); }
            else if (timeRange === 'week') { const d = new Date(now); d.setDate(d.getDate()-7); start = d.toISOString(); }
            else { const d = new Date(now); d.setMonth(d.getMonth()-1); start = d.toISOString(); }
            const res = await analyticsAPI.getMultiStore({ start_date: start, end_date: end });
            const d = res?.data ?? res;
            setMultiStoreStats(d);
            setStats({ total_sales: d?.summary?.total_sales??0, total_orders: d?.summary?.total_orders??0, by_status:{ completed: d?.summary?.total_orders??0 } });
        } catch { setMultiViewError(true); }
        finally { setMultiViewLoading(false); }
    }, [timeRange]);

    /* ─── 이펙트 ─── */
    useEffect(() => {
        if (user && !stores?.length && !storesLoading) {
            refetchStores();
        }
    }, [user, stores, storesLoading, refetchStores]);

    useEffect(() => {
        if (isMultiView) fetchMultiStoreData();
        else if (selectedStore) fetchStoreData(selectedStore.id);
    }, [isMultiView, selectedStore, fetchStoreData, fetchMultiStoreData]);

    /* ─── 자동 새로고침 (60초) ─── */
    useEffect(() => {
        clearInterval(refreshTimer.current);
        if (!isMultiView && selectedStore) {
            refreshTimer.current = setInterval(() => fetchStoreData(selectedStore.id, true), 60_000);
        }
        return () => clearInterval(refreshTimer.current);
    }, [isMultiView, selectedStore, fetchStoreData]);

    const soundEnabledRef = useRef(soundEnabled);
    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    // 실시간 AI 결제 변동성 감사 경보 소켓 수신 핸들러 추가
    useEffect(() => {
        const socketInstance = getSocket();
        if (socketInstance && selectedStore) {
            const handleAnomaly = (payload) => {
                if (parseInt(payload.storeId || payload.store_id) === parseInt(selectedStore.id)) {
                    setAnomalyAlert(payload);
                    if (soundEnabledRef.current) {
                        notificationSound.playUrgent?.();
                    }
                }
            };
            socketInstance.on('system:anomaly_alert', handleAnomaly);
            return () => socketInstance.off('system:anomaly_alert', handleAnomaly);
        }
    }, [selectedStore]);

    useEffect(() => {
        const cleanup = onNewOrder(() => {
            if (selectedStore?.id) {
                fetchStoreData(selectedStore.id, true);
            }
            if (soundEnabledRef.current) notificationSound.playNewOrder();
        });
        return cleanup;
    }, [selectedStore, fetchStoreData]);

    useEffect(() => {
        const cleanup = onOrderUpdated((payload) => {
            setRecentOrders(prev => prev.map(o => o.id === payload.order_id ? { ...o, status: payload.status } : o));
        });
        return cleanup;
    }, []);

    const handleNav = useCallback((path) => {
        const s = selectedStore || stores[0];
        navigate(s?.id ? `/admin/stores/${s.id}/${path}` : '/admin/stores/new');
    }, [selectedStore, stores, navigate]);

    const pendingCount = recentOrders.filter(o => o.status === 'pending').length;

    /* ── 슈퍼관리자: 플랫폼 대시보드로 분기 (단일 매장 오너 뷰 대신) ── */
    if (user?.role === 'super_admin') return <SuperAdminDashboard />;

    /* ── 로딩 (TDS 다크 Skeleton) ── */
    if (loading) return (
        <div className="p-4 space-y-4">
            <Skeleton dark className="h-14 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} dark className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton dark className="h-10 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} dark className="h-20 rounded-2xl" />)}
            </div>
            <div className="space-y-2">
                {[0,1,2,3].map(i => <Skeleton key={i} dark className="h-16 rounded-2xl" />)}
            </div>
        </div>
    );

    /* ── 매장 없음 ── */
    if (stores.length === 0) {
        const isSuper = user?.role === 'super_admin';
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <EmptyState
                    tone="dark"
                    icon={isSuper ? '🛰️' : '🏪'}
                    title={isSuper ? '관리할 매장을 찾지 못했습니다' : '등록된 매장이 없습니다'}
                    description={isSuper ? '지역 커뮤니티/매장 검색에서 매장을 찾거나, 매장 정보 보강 도구를 사용하세요.' : '팅커벨 도우미와 함께 첫 매장을 설정해보세요!'}
                    action={
                        isSuper ? (
                            <Button variant="gradient" size="lg" onClick={() => navigate('/admin/enrich-stores')} className="px-8">
                                <Store size={20} /> 매장 정보 보강
                            </Button>
                        ) : (
                            <Button variant="gradient" size="lg" onClick={() => navigate('/admin/setup')} className="px-8">
                                <Plus size={20} /> 첫 매장 만들기
                            </Button>
                        )
                    }
                />
            </div>
        );
    }

    /* ── 빠른 실행 메뉴 ── */
    const quickActions = [
        { label: '주문 관리', path: 'orders',   icon: ReceiptText, color: 'from-orange-500 to-amber-500',   badge: pendingCount },
        { label: '메뉴 관리', path: 'menu',     icon: ChefHat,     color: 'from-blue-500 to-cyan-500',      badge: 0 },
        { label: '테이블',    path: 'tables',   icon: LayoutGrid,  color: 'from-violet-500 to-purple-500',  badge: 0 },
        { label: '매출 분석', path: 'stats',    icon: BarChart3,   color: 'from-emerald-500 to-teal-500',   badge: 0 },
        { label: '직원 관리', path: 'staff',    icon: Users,       color: 'from-rose-500 to-pink-500',      badge: 0 },
        { label: '리뷰 관리', path: 'reviews',  icon: MessageSquareText, color: 'from-fuchsia-500 to-pink-500', badge: 0 },
        { label: '정산',      path: 'settlements', icon: DollarSign, color: 'from-amber-500 to-yellow-500', badge: 0 },
    ];

    return (
        /* pb-20: 모바일 하단 네비게이션 여백 */
        <div className="space-y-4 pb-20 md:pb-6 px-0">

            <SystemStatusWidget />

            {/* ── 모바일 헤더 ── */}
            <div className="flex items-center justify-between px-1 pt-1">
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-bold">{getGreeting()}, {user?.name || '사장님'}!</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <h1 className="text-lg font-black text-white truncate">
                            {isMultiView ? '전체 매장' : (selectedStore?.name || '매장')}
                        </h1>
                        {!isMultiView && stores.length > 1 && (
                            <select aria-label="매장 선택"
                                value={selectedStore?.id || ''}
                                onChange={e => changeStore(parseInt(e.target.value))}
                                className="text-[10px] font-bold bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-300 outline-none max-w-[100px]"
                            >
                                {stores.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
                            </select>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <CalendarDays size={9} /> {getTodayStr()}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* 매장 추가 */}
                    <button type="button" onClick={() => navigate('/admin/setup')}
                        aria-label="매장 추가"
                        className="flex items-center gap-1 h-9 px-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-500/20 hover:brightness-105 active:scale-95 transition-all">
                        <Plus size={15} aria-hidden="true" /> <span className="hidden sm:inline">매장 추가</span>
                    </button>
                    {/* 대기 주문 알림 */}
                    <button type="button" onClick={() => handleNav('orders')}
                        aria-label={pendingCount > 0 ? `대기 주문 ${pendingCount}건 보기` : '주문서로 이동'}
                        className="relative p-2.5 bg-white/5 border border-white/10 rounded-xl">
                        <Bell size={16} aria-hidden="true" className={pendingCount > 0 ? 'text-orange-400' : 'text-slate-500'} />
                        {pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 tabular-nums">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    {/* 새로고침 */}
                    <button type="button" onClick={() => isMultiView ? fetchMultiStoreData() : fetchStoreData(selectedStore?.id)}
                        aria-label="새로고침" aria-busy={refreshing}
                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                        <RefreshCw size={15} aria-hidden="true" className={`text-slate-500 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 실시간 AI 매출 변동성 위기 경보 비상 배너 (SLA 지표 차단 방지) */}
            <AnimatePresence>
                {anomalyAlert && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mx-1 bg-rose-500/10 border border-rose-500/30 p-5 rounded-3xl flex items-start justify-between gap-4 animate-pulse relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,rgba(244,63,94,0.06),transparent_70%)] pointer-events-none" />
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={20} />
                            <div className="text-left space-y-1">
                                <h4 className="text-sm font-black text-rose-400">{anomalyAlert.title}</h4>
                                <p className="text-xs text-slate-300 leading-relaxed font-semibold">{anomalyAlert.message}</p>
                                <div className="flex flex-wrap items-center gap-4 pt-1.5 font-mono text-[10px] text-slate-500 font-bold">
                                    <span>Z-Score: <strong className="text-rose-400">{anomalyAlert.zScore?.toFixed(2)}</strong></span>
                                    <span>현재 1시간 주문: <strong className="text-rose-400">{anomalyAlert.currentHourOrders}건</strong></span>
                                    <span>24시간 평균: <strong className="text-slate-400">{anomalyAlert.mean?.toFixed(1)}건</strong></span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setAnomalyAlert(null)}
                            className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-200 transition-colors shrink-0 relative z-10"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 실시간 대화 기반 직원 호출 현황판 (Franchise Calls Aggregator) */}
            <AnimatePresence>
                {activeCalls.length > 0 && !isMultiView && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mx-1 p-5 rounded-3xl bg-orange-500/[0.02] border border-orange-500/20 space-y-3"
                    >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                                <Bell className="text-orange-500 animate-bounce" size={16} />
                                <h3 className="text-xs font-black text-orange-400">실시간 매장 직원 호출 현황 ({activeCalls.length}건)</h3>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {activeCalls.map((call) => {
                                const parsedData = call.data || {};
                                return (
                                    <div key={call.id} className="p-3 bg-slate-950/60 border border-white/5 rounded-xl flex items-center justify-between text-xs gap-3">
                                        <div className="min-w-0 flex-1 text-left">
                                            <p className="font-bold text-slate-200">
                                                🛎️ {parsedData.tableName || '포장'}번 테이블 호출 : <strong className="text-orange-400">"{parsedData.type || '직원 호출'}"</strong>
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500 font-bold">
                                                <span>{new Date(call.created_at).toLocaleTimeString('ko-KR', { hour12: false })}</span>
                                                <span>·</span>
                                                <span className={parsedData.isStaffConnected ? 'text-emerald-500' : 'text-slate-600'}>
                                                    {parsedData.isStaffConnected ? '스태프 세션 온라인 수신' : '백업 큐 기록'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => markAsRead(call.id)}
                                            className="px-3 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-[10px] tracking-wider transition-all active:scale-95 shrink-0 flex items-center gap-1 shadow-md shadow-orange-500/10"
                                        >
                                            <span>호출 확인</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 뷰 전환 + 기간 선택 ── */}
            <div className="flex items-center gap-2 px-1">
                {/* 뷰 토글 */}
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 flex-shrink-0">
                    <button onClick={() => setIsMultiView(false)}
                        className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${!isMultiView ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
                        단일
                    </button>
                    {stores.length > 1 && (
                        <button onClick={() => setIsMultiView(true)}
                            className={`px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all ${isMultiView ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>
                            전체
                        </button>
                    )}
                </div>
                {/* 기간 탭 */}
                <div className="flex flex-1 bg-white/5 border border-white/10 rounded-xl p-1">
                    {[['today','오늘'],['week','주간'],['month','월간']].map(([v,l]) => (
                        <button key={v} onClick={() => setTimeRange(v)}
                            className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${timeRange === v ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 통계 카드 ── */}
            <div className="grid grid-cols-2 xs:grid-cols-2 gap-2.5 sm:gap-3 px-1">
                {[
                    {
                        title: '총 매출', icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-500/10',
                        value: formatPrice(stats?.total_sales || 0),
                        trend: comparison?.growth?.sales, accent: 'border-orange-500/20',
                    },
                    {
                        title: '총 주문', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10',
                        value: `${stats?.total_orders || 0}건`,
                        trend: comparison?.growth?.orders, accent: 'border-blue-500/20',
                    },
                    {
                        title: '완료율', icon: BadgeCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
                        value: stats?.total_orders > 0
                            ? `${Math.round(((stats.by_status?.completed||0)/stats.total_orders)*100)}%` : '0%',
                        trend: undefined, accent: 'border-emerald-500/20',
                    },
                    {
                        title: '매장 상태', icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10',
                        value: pendingCount > 0 ? `대기 ${pendingCount}건` : (stats?.total_orders > 0 ? '정상' : '대기중'),
                        trend: undefined, accent: pendingCount > 0 ? 'border-orange-500/40' : 'border-violet-500/20',
                    },
                ].map(({ title, icon: Icon, color, bg, value, trend, accent }) => (
                    <div key={title} className={`bg-white/5 border ${accent} rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 relative overflow-hidden`}>
                        <div className={`p-2 sm:p-2.5 rounded-xl ${bg} shrink-0`}>
                            <Icon size={16} className={color} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-[9px] sm:text-[11px] text-slate-500 font-bold truncate">{title}</p>
                                {trend !== undefined && (
                                    <div className={`shrink-0 flex items-center text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded-md gap-0.5 ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                        {trend >= 0 ? <ArrowUpRight size={8}/> : <ArrowDownRight size={8}/>}
                                        {Math.abs(trend)}%
                                    </div>
                                )}
                            </div>
                            <p className="text-base sm:text-lg font-black text-white leading-tight tabular-nums truncate">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 차트 섹션 (Lazy Loading + Suspense) ── */}
            {selectedStore && !isMultiView && (
                <div className="space-y-4 px-1">
                    <Suspense fallback={<SkeletonChart />}>
                        <SalesTrendChart storeId={selectedStore.id} />
                    </Suspense>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TopProductsList storeId={selectedStore.id} />
                        <Suspense fallback={<SkeletonDonut />}>
                            <OrderStatusDonut stats={stats} />
                        </Suspense>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Suspense fallback={<SkeletonChart />}>
                            <PeakHoursBar storeId={selectedStore.id} />
                        </Suspense>
                        <Suspense fallback={<SkeletonChart />}>
                            <SalesForecastWidget storeId={selectedStore.id} />
                        </Suspense>
                    </div>
                    <RecentReviewsFeed storeId={selectedStore.id} />
                </div>
            )}

            {/* ── 빠른 실행 ── */}
            <div className="px-1">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                        <Zap size={15} className="text-orange-400" /> 빠른 실행
                    </h2>
                </div>
                <div className="grid grid-cols-3 xs:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
                    {quickActions.map(({ label, path, icon: Icon, color, badge }) => (
                        <button key={path} onClick={() => handleNav(path)}
                            className="relative flex flex-col items-center gap-1.5 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/10 transition-all active:scale-95">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                                <Icon size={16} className="text-white" />
                            </div>
                            <span className="text-[9px] sm:text-[11px] font-black text-slate-400 text-center leading-tight">{label}</span>
                            {badge > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 bg-orange-500 text-white text-[8px] sm:text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg border border-slate-900">
                                    {badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 실시간 주문 / 다점포 ── */}
            <div className="px-1">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                        {isMultiView ? (
                            <><TrendingUp size={15} className="text-indigo-400" /> 매장별 실적</>
                        ) : (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                                </span>
                                실시간 주문
                                {pendingCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded-md">
                                        대기 {pendingCount}
                                    </span>
                                )}
                            </>
                        )}
                    </h2>
                    {!isMultiView && (
                        <Link to={`/admin/stores/${selectedStore?.id}/orders`}
                            className="text-[10px] font-black text-orange-400 flex items-center gap-1 hover:text-orange-300 transition-colors">
                            전체 <ArrowUpRight size={12} />
                        </Link>
                    )}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    {isMultiView ? (
                        multiViewLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-[11px] text-slate-500 font-bold">전체 매장 집계 중...</p>
                            </div>
                        ) : multiViewError ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <AlertCircle size={32} className="text-rose-400/50" />
                                <p className="text-xs text-slate-500">데이터를 불러오지 못했습니다</p>
                                <button onClick={fetchMultiStoreData} className="px-4 py-2 text-xs font-black text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/10">다시 시도</button>
                            </div>
                        ) : multiStoreStats?.stores?.length > 0 ? (
                            multiStoreStats.stores.map((s, idx) => (
                                <div key={s.store_id} className="px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-all border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-white/10 text-white rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0">{idx+1}</div>
                                        <div className="min-w-0">
                                            <p className="font-black text-white text-sm truncate">{s.store_name}</p>
                                            <p className="text-[10px] text-slate-500 font-bold">{s.total_orders}건</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black text-indigo-400">{formatPrice(s.total_sales)}</p>
                                        <div className="mt-1 h-1 w-20 bg-white/10 rounded-full overflow-hidden ml-auto">
                                            <div className="h-full bg-indigo-500" style={{ width: `${(s.total_sales/(multiStoreStats.summary?.total_sales||1))*100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-16 text-center">
                                <Store size={32} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-xs text-slate-500">해당 기간 집계 데이터 없음</p>
                            </div>
                        )
                    ) : recentOrders.length === 0 ? (
                        <div className="py-16 text-center px-6 space-y-3">
                            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto border border-orange-500/20">
                                <ShoppingBag size={28} className="text-orange-400" />
                            </div>
                            <p className="text-white font-black text-sm">아직 주문이 없습니다</p>
                            <p className="text-slate-500 text-xs">QR 스캔 후 고객이 주문하면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {recentOrders.map(order => (
                                <Link key={order.id} to={`/admin/stores/${selectedStore?.id}/orders`}
                                    className="px-4 py-4 flex items-center gap-3 hover:bg-white/5 transition-all active:bg-white/10 block">
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-[11px] ${order.status === 'pending' ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                                            #{order.order_number?.slice(-3) ?? '---'}
                                        </div>
                                        {order.status === 'pending' && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500 border border-slate-950" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-white text-base truncate">{order.table_name || '포장'}</span>
                                            <span className="text-[9px] bg-white/10 text-slate-400 px-1 py-0.5 rounded font-bold flex-shrink-0">{order.customer_name || '비회원'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Clock size={10} className="text-slate-600 flex-shrink-0" />
                                            <span className="text-[11px] text-slate-500">{formatTime(order.created_at)}</span>
                                            <span className="text-[11px] font-black text-orange-400">{formatPrice(order.total_amount)}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <StatusBadge status={order.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-[9px] text-slate-700 text-right mt-1.5 px-1 pb-4">
                    최근 갱신: {lastRefresh.getHours().toString().padStart(2,'0')}:{lastRefresh.getMinutes().toString().padStart(2,'0')}:{lastRefresh.getSeconds().toString().padStart(2,'0')} · 60초 자동 갱신
                </p>
            </div>

            {/* ── 데이터 내보내기 ── */}
            {selectedStore && !isMultiView && (
                <ExportPanel storeId={selectedStore.id} />
            )}

            {/* ── 추가 도구 (데스크톱용) ── */}
            <div className="hidden md:block px-1">
                <div className="flex items-center gap-2 mb-3">
                    <Settings size={15} className="text-slate-500" />
                    <h2 className="text-sm font-black text-white">전체 운영 도구</h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                        { label: '재고 관리',   path: 'inventory',     icon: Activity,    desc: '식재료·부자재 재고 추적',    grad: 'from-cyan-500 to-blue-500' },
                        { label: '고객 관리',   path: 'customers',     icon: Users,       desc: '단골 고객 CRM 관리',         grad: 'from-violet-500 to-purple-500' },
                        { label: '예약 관리',   path: 'reservations',  icon: CalendarDays,desc: '테이블 예약 및 일정 관리',   grad: 'from-rose-500 to-pink-500' },
                        { label: '영수증 설정', path: 'receipt-settings', icon: ReceiptText, desc: '인쇄 양식 설정',           grad: 'from-amber-500 to-orange-500' },
                        { label: '분석 대시보드',path: 'analytics',    icon: BarChart3,   desc: '고급 데이터 분석',           grad: 'from-emerald-500 to-teal-500' },
                        { label: '알림 템플릿', path: 'notification-templates', icon: Bell, desc: '자동 알림 문구 관리',      grad: 'from-sky-500 to-indigo-500' },
                        { label: '개발자 콘솔', path: 'developer',     icon: Code2,       desc: 'Open API·웹훅 연동',         grad: 'from-slate-500 to-gray-600' },
                        { label: 'QR 커스터마이징', path: 'qr-customizer', icon: QrCode,   desc: '브랜딩 QR(색상·로고)',      grad: 'from-teal-500 to-emerald-600' },
                        { label: '제휴 마케팅', path: 'partnerships',  icon: Handshake,   desc: '매장 간 제휴·크로스 프로모션', grad: 'from-pink-500 to-rose-600' },
                        { label: 'AI 팅커벨',   path: null,            icon: Sparkles,    desc: 'AI 도우미 서비스',           grad: 'from-indigo-500 to-violet-500', navTo: '/admin/tinkerbell' },
                    ].map(tool => (
                        <button key={tool.label}
                            onClick={() => tool.navTo ? navigate(tool.navTo) : handleNav(tool.path)}
                            className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group text-left">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.grad} flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                                <tool.icon size={18} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-white text-sm group-hover:text-orange-400 transition-colors">{tool.label}</p>
                                <p className="text-[10px] text-slate-500 truncate">{tool.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── AI 팅커벨 배너 (데스크톱) ── */}
            <div className="hidden md:block rounded-3xl p-7 text-white relative overflow-hidden border border-white/10 mx-1"
                style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)' }}>
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-20 blur-2xl" style={{ background: 'radial-gradient(circle,#6366f1,transparent)' }} />
                <div className="relative z-10 flex items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                                <Sparkles size={15} className="text-indigo-400" />
                            </div>
                            <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">AI 도우미</span>
                        </div>
                        <h4 className="text-xl font-black mb-2">AI 매출 예측 · <span className="text-indigo-400">팅커벨</span></h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">고객 방문 패턴 분석, 피크타임 예측, 인기 메뉴 자동 추천으로 매출을 극대화하세요.</p>
                    </div>
                    <button onClick={() => navigate('/admin/tinkerbell')}
                        className="flex-shrink-0 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black text-sm transition-all whitespace-nowrap">
                        지금 시작
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MasterDashboard;

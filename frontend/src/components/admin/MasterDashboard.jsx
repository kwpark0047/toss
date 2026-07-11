import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storesAPI, ordersAPI, analyticsAPI, exportAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatPrice, formatTime } from '../../utils/format';
import EmptyState from '../common/EmptyState';
import Skeleton from '../common/Skeleton';
import SuperAdminDashboard from './SuperAdminDashboard';
import Button from '../common/Button';
import { Store, ShoppingBag, DollarSign, Clock, Plus, ChevronRight, BarChart3, Users, TrendingUp, Activity, Zap, ArrowUpRight, ArrowDownRight, Sparkles, Settings, RefreshCw, Bell, QrCode, LayoutGrid, Home, ReceiptText, BadgeCheck, ChefHat, AlertCircle, CalendarDays, Download, FileSpreadsheet, FileText, Loader2, MessageSquareText, Code2, Handshake } from 'lucide-react';

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
    // 알 수 없는 상태를 '취소'로 오표시하지 않도록 중립 fallback
    const c = cfg[status] ?? { label: status || '-', cls: 'bg-white/10 text-slate-400 border-white/20' };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${c.cls}`}>{c.label}</span>
    );
};

const MasterDashboard = () => {
    const { user, consumeStoresCache } = useAuth();
    const navigate  = useNavigate();
    const { notifications, markAsRead } = useNotifications();

    // 실시간으로 수신된 읽지 않은 직원 호출 알림만 집계/정량화 가동
    const activeCalls = useMemo(() => {
        return notifications.filter(n => n.type === 'MANAGER_CALL' && !n.is_read);
    }, [notifications]);

    const [stores,          setStores]          = useState([]);
    const [selectedStore,   setSelectedStore]   = useState(null);
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

    /* ─── 매장 로딩 ─── */
    const fetchStores = useCallback(async () => {
        try {
            const cached = consumeStoresCache?.();
            let list;
            if (cached && cached.length > 0) {
                list = cached;
                setStores(list);
                setSelectedStore(list[0]);
                setLoading(false);
                storesAPI.getMy()
                    .then(r => {
                        const f = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
                        if (f.length > 0) { setStores(f); setSelectedStore(s => s ?? f[0]); }
                    }).catch(() => {});
                return;
            }
            // super_admin은 전체(15만+)를 덤프하지 않고 최근 50개만 로드(관리 대상 선택용)
            const res = user?.role === 'super_admin' ? await storesAPI.getAll({ limit: 50 }) : await storesAPI.getMy();
            list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
            setStores(list);
            if (list.length > 0) setSelectedStore(list[0]);
        } catch (e) {
            console.error('매장 로딩 실패:', e);
        } finally {
            setLoading(false);
        }
    }, [user?.role, consumeStoresCache]);

    /* ─── 단일 매장 데이터 ─── */
    const fetchStoreData = useCallback(async (storeId, silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const [sRes, oRes, cRes] = await Promise.allSettled([
                ordersAPI.getStats(storeId),
                ordersAPI.getByStore(storeId),
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
            let start, end = now.toISOString();
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
    useEffect(() => { fetchStores(); }, [fetchStores]);

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

    /* ── 매장 없음 ── (super_admin은 매장 소유가 아닌 관리 주체이므로 온보딩 대신 관리 안내) */
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
                                onChange={e => setSelectedStore(stores.find(s => s.id === parseInt(e.target.value)))}
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

            {/* ── 뷰 전환 + 기간 선택 ── */}
            <div className="flex items-center gap-2">
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
                            className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all ${timeRange === v ? 'bg-white text-slate-900 shadow' : 'text-slate-400'}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 통계 카드 (모바일 2열 / 초소형 1열) ── */}
            <div className="grid grid-cols-2 xs:grid-cols-2 gap-2.5 sm:gap-3">
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

            {/* ── 빠른 실행 (모바일 4열 / 초소형 3열) ── */}
            <div>
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

            {/* ── 실시간 직원 호출 현황 집계 및 확인 레이어 (SLA 실측 장착) ── */}
            {selectedStore && !isMultiView && (
                <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-black text-white flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeCalls.length > 0 ? 'bg-rose-400' : 'bg-slate-400'}`} />
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeCalls.length > 0 ? 'bg-rose-500' : 'bg-slate-500'}`} />
                            </span>
                            <span>실시간 직원 호출 수신반</span>
                            {activeCalls.length > 0 && (
                                <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-md animate-pulse">
                                    호출 {activeCalls.length}
                                </span>
                            )}
                        </h2>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4">
                        {activeCalls.length === 0 ? (
                            <div className="py-6 text-center text-slate-500 flex flex-col items-center justify-center gap-1.5">
                                <CheckCircle className="size-6 text-slate-600" />
                                <p className="text-xs font-semibold">대기 중인 직원 호출 신호가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {activeCalls.map((call) => {
                                    const callData = typeof call.data === 'string' ? JSON.parse(call.data) : (call.data || {});
                                    return (
                                        <div key={call.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                                    <span className="text-orange-400 font-mono font-black">[{callData.tableName || '포장'}]</span>
                                                    <span>호출 도착!</span>
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1 leading-normal">
                                                    구분 : <span className="font-semibold text-slate-300">"{callData.type || '직원 호출'}"</span>
                                                    {callData.isStaffConnected !== undefined && (
                                                        <span className="ml-2 font-mono text-[10px] text-slate-500">
                                                            ({callData.isStaffConnected ? '기기 실시간 연결 수신됨' : '오프라인 큐 백업됨'})
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    markAsRead(call.id);
                                                    try {
                                                        const { toast } = require('react-toastify');
                                                        toast.success('호출 확인을 완료했습니다. 테이블로 이동해 주세요!');
                                                    } catch (_) {
                                                        alert('호출 확인이 완료되었습니다. 해당 테이블로 이동해 주십시오.');
                                                    }
                                                }}
                                                className="px-4 h-9 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center shrink-0"
                                            >
                                                호출 해결
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 실시간 주문 / 다점포 ── */}
            <div>
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
            <div className="hidden md:block">
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
            <div className="hidden md:block rounded-3xl p-7 text-white relative overflow-hidden border border-white/10"
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

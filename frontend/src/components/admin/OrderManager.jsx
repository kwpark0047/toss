import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ordersAPI, storesAPI, paymentsAPI, staffAPI } from '../../api';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, ChefHat, Package,
  RefreshCw, Search, Calendar, Bell, Volume2, VolumeX, Eye, X,
  AlertCircle, TrendingUp, Filter, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import notificationSound from '../../utils/notificationSound';
import { onNewOrder, onOrderUpdated } from '../../utils/socket';
import { formatPrice, formatTime, formatDateTime } from '../../utils/format';
import { handleApiError } from '../../utils/apiError';
import OrderCard from './OrderCard';
import OrderDetailModal from './OrderDetailModal';

/**
 * [정적 설정] 주문 상태별 프리미엄 설정
 */
const statusConfig = {
  pending: {
    label: '대기 중',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    glow: 'shadow-amber-400/20',
    icon: Clock,
    next: 'confirmed'
  },
  confirmed: {
    label: '주문 확인',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    glow: 'shadow-blue-400/20',
    icon: CheckCircle,
    next: 'preparing'
  },
  preparing: {
    label: '조리 중',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
    glow: 'shadow-purple-400/20',
    icon: ChefHat,
    next: 'ready'
  },
  ready: {
    label: '준비 완료',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    glow: 'shadow-emerald-400/20',
    icon: Package,
    next: 'completed'
  },
  completed: {
    label: '완료',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
    border: 'border-slate-400/20',
    glow: 'shadow-slate-400/20',
    icon: CheckCircle,
    next: null
  },
  cancelled: {
    label: '취소',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    glow: 'shadow-rose-400/20',
    icon: XCircle,
    next: null
  }
};


const OrderManager = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    // KST(UTC+9) 기준 오늘 날짜 (서버 날짜 필터와 동일한 기준)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState(null);

  const prevOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const fetchMyRole = useCallback(async () => {
    try {
      const res = await staffAPI.getMyRole(storeId);
      if (res.staff_id) setCurrentStaffId(res.staff_id);
    } catch (err) { console.error('Role check failed:', err); }
  }, [storeId]);

  useEffect(() => { fetchMyRole(); }, [fetchMyRole]);

  const fetchStore = useCallback(async (signal) => {
    try {
      const res = await storesAPI.getById(storeId, { signal });
      setStore(res.data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
    }
  }, [storeId]);

  const fetchOrders = useCallback(async (signal) => {
    try {
      const status = selectedStatus === 'all' ? undefined : selectedStatus;
      const res = await ordersAPI.getByStore(storeId, status, selectedDate);
      const newOrders = res.data;

      if (!isFirstLoadRef.current && soundEnabledRef.current) {
        const newPendingOrders = newOrders.filter(order =>
          order.status === 'pending' && !prevOrderIdsRef.current.has(order.id)
        );

        if (newPendingOrders.length > 0) {
          notificationSound.playNewOrder();
          setNewOrderAlert(true);
          setTimeout(() => setNewOrderAlert(false), 5000);
        }
      }

      prevOrderIdsRef.current = new Set(newOrders.map(o => o.id));
      isFirstLoadRef.current = false;
      setOrders(newOrders);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedStatus, selectedDate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStore(controller.signal);
    return () => controller.abort();
  }, [fetchStore]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => fetchOrders(), 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchOrders]);

  // 새 주문 접수 → 목록 갱신 + 알림음
  // soundEnabledRef 사용으로 sound 토글 시 리스너 재등록 없이 항상 최신 상태 반영
  useEffect(() => {
    const cleanup = onNewOrder(() => {
      fetchOrders();
      if (soundEnabledRef.current) notificationSound.playNewOrder();
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 5000);
    });
    return cleanup;
  }, [fetchOrders]);

  // 주문 상태 변경 → 해당 주문만 즉시 인플레이스 업데이트 (전체 재조회 없이)
  useEffect(() => {
    const cleanup = onOrderUpdated((payload) => {
      setOrders(prev => prev.map(o =>
        o.id === payload.order_id ? { ...o, status: payload.status } : o
      ));
    });
    return cleanup;
  }, []);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(order =>
      order.order_number?.toLowerCase().includes(term) ||
      order.customer_name?.toLowerCase().includes(term) ||
      order.table_name?.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const { statusCounts, pendingCount } = useMemo(() => {
    const counts = { all: orders.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = orders.filter(o => o.status === status).length;
    });
    return {
      statusCounts: counts,
      pendingCount: (counts.pending || 0) + (counts.confirmed || 0)
    };
  }, [orders]);

  const toggleSound = useCallback(() => {
    notificationSound.init();
    notificationSound.resume();
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    notificationSound.setEnabled(newState);
    if (newState) notificationSound.playSuccess();
  }, [soundEnabled]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus, currentStaffId);
      if (soundEnabled) notificationSound.playSuccess();
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      handleApiError(e, '주문 상태 변경에 실패했습니다');
    }
  };

  const handlePaymentCancel = async (orderId) => {
    const reason = prompt('취소 사유를 입력하세요.', '관리자 취소');
    if (!reason) return;

    if (!window.confirm('결제를 취소하시겠습니까? 고객에게 환불이 진행됩니다.')) return;

    setLoading(true);
    try {
      await paymentsAPI.cancelByOrder(orderId, { cancelReason: reason });
      fetchOrders();
      setShowDetail(false);
    } catch (err) {
      handleApiError(err, '결제 취소에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full mb-4"
        />
        <p className="text-slate-500 font-black text-xs tracking-widest uppercase">Initializing Live Feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 px-3 lg:px-4">
      {/* 1. 실시간 알림 팝업 */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.85 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="px-5 py-3 bg-orange-500 text-white rounded-2xl shadow-2xl shadow-orange-500/40 flex items-center gap-3 border border-orange-400/50">
              <Bell size={18} className="animate-pulse" />
              <div>
                <p className="font-black text-sm">🛎️ 새 주문 접수!</p>
                <p className="text-[10px] font-bold opacity-80">대기 목록을 확인해주세요</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 헤더 — 모바일 컴팩트 */}
      <div className="flex items-center justify-between gap-3 mb-5 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/admin"
            className="flex-shrink-0 w-9 h-9 lg:w-11 lg:h-11 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              주문 현황
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </h1>
            <p className="text-slate-500 font-bold text-[10px] mt-0.5 truncate">{store?.name}</p>
          </div>
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendingCount > 0 && (
            <div className="hidden sm:flex px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl items-center gap-2">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              <span className="text-amber-400 font-black text-xs">{pendingCount}건 대기</span>
            </div>
          )}
          <button onClick={toggleSound}
            className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${
              soundEnabled ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`hidden sm:flex h-9 px-3 rounded-xl border transition-all items-center gap-1.5 font-black text-[10px] ${
              autoRefresh ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
            <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
            자동
          </button>
          <motion.button whileTap={{ rotate: 180 }} onClick={() => fetchOrders()}
            className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <RefreshCw size={15} />
          </motion.button>
        </div>
      </div>

      {/* 모바일 대기 카운트 */}
      {pendingCount > 0 && (
        <div className="sm:hidden flex px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
          <span className="text-amber-400 font-black text-sm">{pendingCount}건 대기 중</span>
        </div>
      )}

      {/* 3. 상태 필터 — 가로 스크롤 칩 (모바일) / 그리드 (데스크탑) */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide lg:grid lg:grid-cols-7 lg:gap-2">
        {/* 전체 */}
        <button onClick={() => setSelectedStatus('all')}
          className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 lg:py-3 rounded-xl border transition-all min-w-[68px] lg:min-w-0 ${
            selectedStatus === 'all'
              ? 'bg-orange-500 border-orange-400 text-white'
              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
          }`}>
          <List size={14} className="mb-1" />
          <p className="text-[9px] font-black opacity-70 whitespace-nowrap">전체</p>
          <p className="text-base font-black leading-none">{statusCounts.all}</p>
        </button>

        {Object.entries(statusConfig).map(([key, conf]) => (
          <button key={key} onClick={() => setSelectedStatus(key)}
            className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 lg:py-3 rounded-xl border transition-all min-w-[68px] lg:min-w-0 ${
              selectedStatus === key
                ? `${conf.bg} ${conf.border} ${conf.color}`
                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
            }`}>
            <conf.icon size={14} className="mb-1" />
            <p className="text-[9px] font-black opacity-70 whitespace-nowrap">{conf.label}</p>
            <p className="text-base font-black leading-none">{statusCounts[key]}</p>
          </button>
        ))}
      </div>

      {/* 4. 검색·날짜 바 */}
      <div className="flex gap-2 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input type="text" placeholder="주문번호, 테이블 검색..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/5 rounded-xl text-white text-sm font-bold placeholder:text-slate-600 outline-none focus:border-orange-500/30 transition-all" />
        </div>
        <div className="relative flex-shrink-0">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={13} />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="pl-9 pr-2 py-2.5 bg-white/5 border border-white/5 rounded-xl text-white text-sm font-bold outline-none appearance-none focus:border-orange-500/30 transition-all w-36" />
        </div>
        <button onClick={() => { setSearchTerm(''); setSelectedStatus('all'); setSelectedDate(new Date().toISOString().split('T')[0]); }}
          className="flex-shrink-0 w-10 h-10 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
          <Filter size={14} />
        </button>
      </div>

      {/* 5. 주문 그리드 */}
      <AnimatePresence mode="popLayout">
        {filteredOrders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="border border-dashed border-white/10 rounded-3xl py-20 text-center">
            <Package size={36} className="text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-black text-slate-400">주문 없음</p>
            <p className="text-slate-600 text-xs mt-1">현재 필터 조건에 맞는 주문이 없습니다</p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                statusConfig={statusConfig}
                onShowDetail={ord => { setSelectedOrder(ord); setShowDetail(true); }}
                onStatusChange={handleStatusChange}
                formatTime={formatTime}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 상세 모달 */}
      <AnimatePresence>
        {showDetail && (
          <OrderDetailModal
            order={selectedOrder}
            statusConfig={statusConfig}
            onClose={() => setShowDetail(false)}
            onStatusChange={handleStatusChange}
            onPaymentCancel={handlePaymentCancel}
            formatDateTime={formatDateTime}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderManager;

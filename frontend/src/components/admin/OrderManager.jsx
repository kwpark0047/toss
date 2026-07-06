import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ordersAPI, storesAPI, paymentsAPI, staffAPI } from '../../api';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, ChefHat, Package,
  RefreshCw, Search, Calendar, Bell, Volume2, VolumeX, Filter, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import notificationSound from '../../utils/notificationSound';
import { onNewOrder, onOrderUpdated } from '../../utils/socket';
import { formatTime, formatDateTime } from '../../utils/format';
import { handleApiError } from '../../utils/apiError';
import OrderCard from './OrderCard';
import OrderDetailModal from './OrderDetailModal';
import EmptyState from '../common/EmptyState';

const statusConfig = {
  pending:   { label: '대기',    color: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Clock,        next: 'confirmed' },
  confirmed: { label: '확인',    color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200',   icon: CheckCircle,  next: 'preparing' },
  preparing: { label: '조리 중', color: 'text-purple-500',  bg: 'bg-purple-50',  border: 'border-purple-200', icon: ChefHat,      next: 'ready' },
  ready:     { label: '준비완료', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200',icon: Package,      next: 'completed' },
  completed: { label: '완료',    color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-200',  icon: CheckCircle,  next: null },
  cancelled: { label: '취소',    color: 'text-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-200',   icon: XCircle,      next: null },
};

// 상태 필터 탭 순서
const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending',   label: '대기' },
  { key: 'confirmed', label: '확인' },
  { key: 'preparing', label: '조리 중' },
  { key: 'ready',     label: '준비완료' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
];

const OrderManager = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
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
  const isFirstLoadRef  = useRef(true);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const fetchMyRole = useCallback(async () => {
    try {
      const res = await staffAPI.getMyRole(storeId);
      if (res.staff_id) setCurrentStaffId(res.staff_id);
    } catch {}
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
        const fresh = newOrders.filter(o => o.status === 'pending' && !prevOrderIdsRef.current.has(o.id));
        if (fresh.length > 0) {
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
    const c = new AbortController();
    fetchStore(c.signal);
    return () => c.abort();
  }, [fetchStore]);

  useEffect(() => {
    const c = new AbortController();
    fetchOrders(c.signal);
    return () => c.abort();
  }, [fetchOrders]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => fetchOrders(), 10000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchOrders]);

  useEffect(() => {
    const cleanup = onNewOrder(() => {
      fetchOrders();
      if (soundEnabledRef.current) notificationSound.playNewOrder();
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 5000);
    });
    return cleanup;
  }, [fetchOrders]);

  useEffect(() => {
    const cleanup = onOrderUpdated((payload) => {
      setOrders(prev => prev.map(o => o.id === payload.order_id ? { ...o, status: payload.status } : o));
    });
    return cleanup;
  }, []);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o =>
      o.order_number?.toLowerCase().includes(term) ||
      o.customer_name?.toLowerCase().includes(term) ||
      o.table_name?.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length };
    Object.keys(statusConfig).forEach(s => { counts[s] = orders.filter(o => o.status === s).length; });
    return counts;
  }, [orders]);

  const pendingCount = (statusCounts.pending || 0) + (statusCounts.confirmed || 0);

  const toggleSound = useCallback(() => {
    notificationSound.init();
    notificationSound.resume();
    const next = !soundEnabled;
    setSoundEnabled(next);
    notificationSound.setEnabled(next);
    if (next) notificationSound.playSuccess();
  }, [soundEnabled]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus, currentStaffId);
      if (soundEnabled) notificationSound.playSuccess();
      fetchOrders();
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => ({ ...prev, status: newStatus }));
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
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-sm font-medium">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 pb-24">

      {/* ── 새 주문 알림 팝업 ──────────────────────────────────────── */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-500/30">
              <Bell size={18} className="shrink-0" />
              <div>
                <p className="font-black text-sm">새 주문 접수!</p>
                <p className="text-[11px] opacity-80">대기 목록을 확인하세요</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 헤더 ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 mb-2">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white leading-tight flex items-center gap-2">
              주문현황
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </h1>
            <p className="text-slate-500 text-xs font-medium">{store?.name}</p>
          </div>
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black rounded-xl">
              {pendingCount}건 대기
            </span>
          )}
          <button
            onClick={toggleSound}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              soundEnabled ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-500'
            }`}
            title={autoRefresh ? '자동갱신 ON' : '자동갱신 OFF'}
          >
            <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 검색 + 날짜 필터 ───────────────────────────────────────── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="주문번호 · 고객 · 테이블"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white/8 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-600 outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>
        <div className="relative">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="pl-9 pr-2 py-2.5 bg-white/8 border border-white/10 rounded-xl text-white text-sm font-medium outline-none focus:border-orange-500/50 transition-colors appearance-none"
          />
        </div>
        {(searchTerm || selectedStatus !== 'all') && (
          <button
            onClick={() => { setSearchTerm(''); setSelectedStatus('all'); }}
            className="w-10 h-10 bg-white/8 border border-white/10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          >
            <Filter size={15} />
          </button>
        )}
      </div>

      {/* ── 상태 탭 (수평 스크롤) ──────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {STATUS_TABS.map(({ key, label }) => {
          const count = statusCounts[key] ?? 0;
          const cfg   = statusConfig[key];
          const isActive = selectedStatus === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedStatus(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all border ${
                isActive
                  ? key === 'all'
                    ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20'
                    : `${cfg?.bg} ${cfg?.border} ${cfg?.color}`
                  : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
              }`}
            >
              {label}
              <span className={`min-w-[20px] text-center text-xs font-black px-1 py-0.5 rounded-md ${
                isActive ? 'bg-black/10' : 'bg-white/10'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 주문 목록 ──────────────────────────────────────────────── */}
      <AnimatePresence mode="popLayout">
        {filteredOrders.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState
              tone="dark"
              icon={<Package size={40} className="text-slate-600" aria-hidden="true" />}
              title="주문 없음"
              description="현재 조건에 맞는 주문이 없습니다"
            />
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          >
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

      {/* ── 상세 모달 ──────────────────────────────────────────────── */}
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

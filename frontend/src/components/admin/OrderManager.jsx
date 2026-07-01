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
import { onNewOrder } from '../../utils/socket';
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState(null);

  const prevOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

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
      const res = await ordersAPI.getByStore(storeId, status, selectedDate, { signal });
      const newOrders = res.data;

      if (!isFirstLoadRef.current && soundEnabled) {
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
      if (!signal?.aborted) setLoading(false);
    }
  }, [storeId, selectedStatus, selectedDate, soundEnabled]);

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

  // 실시간 소켓 리스너: 새 주문 접수 즉시 목록 갱신
  useEffect(() => {
    const cleanup = onNewOrder(() => {
      fetchOrders();
      if (soundEnabled) notificationSound.playNewOrder();
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 5000);
    });
    return cleanup;
  }, [fetchOrders, soundEnabled]);

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
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {/* 1. 실시간 알림 팝업 */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -100, scale: 0.8 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="px-8 py-4 bg-orange-500 text-white rounded-[2rem] shadow-2xl shadow-orange-500/40 flex items-center gap-4 border border-orange-400/50">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <Bell size={20} />
              </div>
              <div>
                <p className="font-black text-sm tracking-tighter">🛎️ 새 주문 접수!</p>
                <p className="text-[10px] font-bold opacity-80 tracking-widest">대기 목록을 확인해주세요</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 헤더 섹션 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-6">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/admin" className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={24} />
            </Link>
          </motion.div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
              주문 현황
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            </h1>
            <p className="text-slate-500 font-bold tracking-widest text-xs mt-1">{store?.name} 실시간 모니터</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && (
            <div className="px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <span className="text-amber-500 font-black text-sm tracking-tighter">{pendingCount}건 대기 중</span>
            </div>
          )}
          
          <button 
            onClick={toggleSound} 
            className={`w-14 h-14 rounded-2xl border transition-all flex items-center justify-center ${
              soundEnabled ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 border-white/10 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>

          <button 
            onClick={() => setAutoRefresh(!autoRefresh)} 
            className={`px-6 h-14 rounded-2xl border transition-all flex items-center gap-3 font-black text-xs tracking-widest ${
              autoRefresh ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/10 text-slate-500'
            }`}
          >
            <RefreshCw size={18} className={autoRefresh ? 'animate-spin' : ''} />
            자동 갱신
          </button>

          <motion.button 
            whileTap={{ rotate: 180 }}
            onClick={() => fetchOrders()} 
            className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={24} />
          </motion.button>
        </div>
      </div>

      {/* 3. 상태 요약 보드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <button 
          onClick={() => setSelectedStatus('all')}
          className={`p-6 rounded-[2rem] border transition-all text-left ${
            selectedStatus === 'all' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
          }`}
        >
          <List size={20} className="mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">전체 주문</p>
          <p className="text-2xl font-black">{statusCounts.all}</p>
        </button>
        
        {Object.entries(statusConfig).map(([key, config]) => (
          <button 
            key={key}
            onClick={() => setSelectedStatus(key)}
            className={`p-6 rounded-[2rem] border transition-all text-left ${
              selectedStatus === key ? `${config.bg} ${config.border} ${config.color}` : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
            }`}
          >
            <config.icon size={20} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{config.label}</p>
            <p className="text-2xl font-black">{statusCounts[key]}</p>
          </button>
        ))}
      </div>

      {/* 4. 제어 패널 */}
      <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 mb-12 flex flex-col md:flex-row gap-6">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text"
            placeholder="주문번호, 고객명, 테이블로 검색..."
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/30 transition-all uppercase text-xs tracking-widest" 
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="pl-14 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none appearance-none focus:border-orange-500/30 transition-all text-xs tracking-widest" 
            />
          </div>
          <button 
            onClick={() => { setSearchTerm(''); setSelectedStatus('all'); setSelectedDate(new Date().toISOString().split('T')[0]); }}
            className="w-14 h-14 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white transition-all"
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* 5. 주문 그리드 */}
      <AnimatePresence mode="popLayout">
        {filteredOrders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/2 border border-dashed border-white/10 rounded-[3rem] py-32 text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-700">
              <Package size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-300 mb-2 tracking-tight">주문 없음</h3>
            <p className="text-slate-600 font-bold tracking-widest text-xs">현재 필터 조건에 맞는 주문이 없습니다</p>
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                statusConfig={statusConfig}
                onShowDetail={(ord) => { setSelectedOrder(ord); setShowDetail(true); }}
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

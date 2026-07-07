import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ordersAPI } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { connectKitchen, onNewOrder, onOrderUpdated } from "../utils/socket";
import {
  ChefHat, Clock, CheckCircle2, XCircle, RefreshCw,
  UtensilsCrossed, Package, Timer, AlertCircle, Bell
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CFG = {
  paid:      { label: "신규 주문", color: "text-teal-400",   border: "border-teal-400",   bg: "bg-teal-400/10",   next: "preparing", nextLabel: "조리 시작", icon: CheckCircle2 },
  pending:   { label: "접수 대기", color: "text-amber-400",  border: "border-amber-400",  bg: "bg-amber-400/10",  next: "confirmed", nextLabel: "주문 확인", icon: Clock },
  confirmed: { label: "주문 확인", color: "text-blue-400",   border: "border-blue-400",   bg: "bg-blue-400/10",   next: "preparing", nextLabel: "조리 시작", icon: CheckCircle2 },
  preparing: { label: "조리 중",   color: "text-purple-400", border: "border-purple-400", bg: "bg-purple-400/10", next: "ready",     nextLabel: "조리 완료", icon: ChefHat },
};

const KitchenDisplay = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newAlert, setNewAlert] = useState(null);
  const alertTimerRef = useRef(null);

  // 주방 디스플레이 접근 허용 역할 — 주문 처리 권한 보유자
  // (실제 RBAC 역할: owner·manager·staff·kitchen·super_admin. owner 누락 버그 수정)
  useEffect(() => {
    const ALLOWED = ["super_admin", "owner", "manager", "staff", "kitchen"];
    if (user && !ALLOWED.includes(user.role)) {
      navigate("/");
    }
  }, [user, navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getByStore(storeId);
      const all = res?.data || res || [];
      setOrders(all.filter(o => ["paid", "pending", "confirmed", "preparing"].includes(o.status)));
    } catch { /* 기존 목록 유지 */ }
    finally { setLoading(false); }
  }, [storeId]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      setOrders(prev =>
        prev
          .map(o => o.id === orderId ? { ...o, status: newStatus } : o)
          .filter(o => ["paid", "pending", "confirmed", "preparing"].includes(o.status))
      );
    } catch { fetchOrders(); }
  };

  const showAlert = (orderNumber) => {
    setNewAlert({ orderNumber });
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setNewAlert(null), 6000);
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchOrders]);

  useEffect(() => {
    connectKitchen(storeId, user?.id);

    const offNew = onNewOrder((payload) => {
      const sid = payload.storeId || payload.store_id;
      if (String(sid) !== String(storeId)) return;
      fetchOrders();
      showAlert(payload.orderNumber || payload.order_number || "");
    });

    const offUpd = onOrderUpdated((payload) => {
      if (String(payload.store_id) !== String(storeId)) return;
      if (["paid", "pending", "confirmed", "preparing"].includes(payload.status)) {
        setOrders(prev => prev.map(o => o.id === payload.order_id ? { ...o, status: payload.status } : o));
      } else {
        setOrders(prev => prev.filter(o => o.id !== payload.order_id));
      }
    });

    return () => { offNew(); offUpd(); };
  }, [storeId, user?.id, fetchOrders]);

  const elapsed = (createdAt) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />
      </div>
    );
  }

  const pendingCount   = orders.filter(o => o.status === "pending").length;
  const preparingCount = orders.filter(o => o.status === "preparing").length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      <AnimatePresence>
        {newAlert && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -80, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.8 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-8 py-4 bg-orange-500 rounded-3xl shadow-2xl shadow-orange-500/40">
              <Bell size={28} className="animate-bounce" />
              <div>
                <p className="font-black text-lg">🛎️ 새 주문 접수!</p>
                {newAlert.orderNumber && (
                  <p className="text-sm font-bold opacity-80">주문번호: {newAlert.orderNumber}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-orange-500/20 rounded-2xl">
            <ChefHat className="w-10 h-10 text-orange-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black">주방 디스플레이</h1>
            <p className="text-slate-500 text-lg">
              대기 {orders.length}건
              {pendingCount > 0 && <span className="ml-2 text-amber-400"> · 미확인 {pendingCount}건</span>}
              {preparingCount > 0 && <span className="ml-2 text-purple-400"> · 조리 중 {preparingCount}건</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`px-6 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all ${
              autoRefresh ? "bg-green-500/20 text-green-400 border border-green-500/20" : "bg-slate-800 text-slate-400"
            }`}
          >
            <RefreshCw className={autoRefresh ? "animate-spin" : ""} size={24} />
            {autoRefresh ? "자동 갱신 ON" : "자동 갱신 OFF"}
          </button>
          <button onClick={fetchOrders} className="px-6 py-4 bg-blue-500 hover:bg-blue-600 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all">
            <RefreshCw size={24} />새로고침
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const cnt = orders.filter(o => o.status === key).length;
          return (
            <div key={key} className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border} flex items-center gap-3`}>
              <cfg.icon size={24} className={cfg.color} />
              <div>
                <p className={`text-sm font-black ${cfg.color}`}>{cfg.label}</p>
                <p className="text-3xl font-black text-white">{cnt}</p>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <UtensilsCrossed className="w-24 h-24 text-slate-700 mb-6" />
          <p className="text-3xl text-slate-500 font-bold">대기 중인 주문이 없습니다</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...orders]
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              .map((order) => {
                const mins = elapsed(order.created_at);
                const isUrgent = mins >= 10 && order.status === "pending";
                const cfg = STATUS_CFG[order.status] || STATUS_CFG.pending;
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`relative p-6 rounded-3xl border-2 ${cfg.bg} ${cfg.border} ${isUrgent ? "animate-pulse" : ""}`}
                  >
                    {isUrgent && (
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                        <AlertCircle size={18} />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-5xl font-black">#{order.order_number?.slice(-3) || order.id}</span>
                      <div className={`flex items-center gap-1.5 ${isUrgent ? "text-red-400" : "text-slate-400"}`}>
                        <Timer size={18} /><span className="text-xl font-bold">{mins}분</span>
                      </div>
                    </div>

                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black mb-3 ${cfg.color} ${cfg.bg}`}>
                      <cfg.icon size={14} />{cfg.label}
                    </div>

                    <div className="mb-4">
                      {order.table_name ? (
                        <span className="px-4 py-2 bg-white/10 rounded-xl font-bold text-lg">{order.table_name}</span>
                      ) : order.table_id ? (
                        <span className="px-4 py-2 bg-white/10 rounded-xl font-bold text-lg">테이블 {order.table_id}</span>
                      ) : (
                        <span className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl font-bold text-lg flex items-center gap-2">
                          <Package size={18} />포장
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 mb-5 max-h-44 overflow-y-auto">
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-lg">
                          <span className="font-medium truncate mr-2">{item.product_name || item.name}</span>
                          <span className="font-black text-2xl flex-shrink-0">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
                        <p className="text-sm text-yellow-300 font-bold">📝 {order.notes}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {cfg.next && (
                        <button
                          onClick={() => updateStatus(order.id, cfg.next)}
                          className={`w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-transform ${
                            cfg.next === "confirmed" ? "bg-blue-500 hover:bg-blue-600" :
                            cfg.next === "preparing" ? "bg-purple-500 hover:bg-purple-600" :
                            "bg-emerald-500 hover:bg-emerald-600"
                          }`}
                        >
                          <cfg.icon size={22} />{cfg.nextLabel}
                        </button>
                      )}
                      {order.status === "pending" && (
                        <button
                          onClick={() => updateStatus(order.id, "cancelled")}
                          className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <XCircle size={18} />주문 취소
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </AnimatePresence>
      )}

      <div className="fixed bottom-6 right-6 px-6 py-3 bg-slate-900 rounded-2xl border border-white/10">
        <Clock className="inline mr-2 text-slate-500" size={20} />
        <span className="text-xl font-bold text-slate-400">
          {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
};

export default KitchenDisplay;

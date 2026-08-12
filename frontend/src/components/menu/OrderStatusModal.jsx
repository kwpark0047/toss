import { formatWon } from '../../utils/format';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, ChefHat, BellRing, Package, Loader2, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ordersAPI } from '@/api';
import { joinOrderRoom, onOrderUpdated } from '@/utils/socket';
import EmptyState from '../common/EmptyState';
import { vibrateClick, vibrateSuccess } from '../../utils/notificationSound';

const STEPS_CONFIG = [
  { key: 'pending',   icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-50',   ring: 'ring-amber-400' },
  { key: 'confirmed', icon: CheckCircle2,  color: 'text-blue-500',    bg: 'bg-blue-50',    ring: 'ring-blue-400' },
  { key: 'preparing', icon: ChefHat,       color: 'text-purple-500',  bg: 'bg-purple-50',  ring: 'ring-purple-400' },
  { key: 'ready',     icon: BellRing,      color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  { key: 'completed', icon: Package,       color: 'text-grey-400',   bg: 'bg-grey-50',   ring: 'ring-grey-300' },
];
const CANCELLED_CONFIG = { key: 'cancelled', icon: X, color: 'text-rose-500', bg: 'bg-rose-50', ring: 'ring-rose-400' };

const STATUS_MSG_KEYS = {
  pending:   'order_status.messages.pending',
  confirmed: 'order_status.messages.confirmed',
  preparing: 'order_status.messages.preparing',
  ready:     'order_status.messages.ready',
  completed: 'order_status.messages.completed',
  cancelled: 'order_status.messages.cancelled',
};


const OrderStatusModal = ({ isOpen, onClose, orderId, storeId, tableNumber, onWriteReview }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [eta, setEta] = useState(null);
  const { t } = useTranslation();

  const STEPS = STEPS_CONFIG.map(s => ({ ...s, label: t(`order_status.steps.${s.key}`) }));
  const CANCELLED = { ...CANCELLED_CONFIG, label: t('order_status.steps.cancelled') };

  const fetchOrder = useCallback(async () => {
    if (!orderId && !storeId) return;
    setLoading(true);
    try {
      if (orderId) {
        const res = await ordersAPI.getById(orderId);
        setOrder(res?.data || res);
      } else {
        const res = await ordersAPI.getByStore(storeId);
        const list = res?.data || res || [];
        const found = [...list]
          .filter(o =>
            String(o.table_id) === String(tableNumber) ||
            o.table_name === tableNumber
          )
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        setOrder(found || null);
      }
    } catch { /* 이전 상태 유지 */ }
    finally { setLoading(false); }
  }, [orderId, storeId, tableNumber]);

  // ETA 조회
  const fetchEta = useCallback(async () => {
    if (!storeId || !order) return;
    const items = (order.items || order.order_items || []).map(item => ({
      product_id: item.product_id || item.id,
      quantity: item.quantity
    }));
    try {
      const res = await ordersAPI.getEta(storeId, items);
      setEta(res?.data || res);
    } catch (e) {
      console.warn('ETA 조회 실패:', e);
    }
  }, [storeId, order]);

  // 모달 열릴 때 초기 로드
  useEffect(() => {
    if (isOpen) {
      setOrder(null);
      fetchOrder();
      setEta(null);
    }
  }, [isOpen, fetchOrder]);

  // ETA 주기적 갱신 (30초마다)
  useEffect(() => {
    if (!isOpen || !storeId) return;
    const t = setInterval(() => {
      fetchEta();
    }, 30000);
    return () => clearInterval(t);
  }, [isOpen, storeId, fetchEta]);

  // 소켓: orderId 룸 구독 + 실시간 상태 수신
  useEffect(() => {
    if (isOpen) {
      setOrder(null);
      fetchOrder();
    }
  }, [isOpen, fetchOrder]);

  // 소켓: orderId 룸 구독 + 실시간 상태 수신
  useEffect(() => {
    if (!isOpen || !orderId) return;
    joinOrderRoom(orderId);
    const off = onOrderUpdated((payload) => {
      if (Number(payload.order_id) !== Number(orderId)) return;
      setOrder(prev => prev ? { ...prev, status: payload.status } : prev);
      setLastUpdated(new Date());
    });
    return off;
  }, [isOpen, orderId]);

  // orderId 없을 때 5초 폴링
  useEffect(() => {
    if (!isOpen || orderId) return;
    const t = setInterval(fetchOrder, 5000);
    return () => clearInterval(t);
  }, [isOpen, orderId, fetchOrder]);

  // 결제완료('paid')는 고객에게 '주문 접수' 단계로 표시 (STEPS/메시지에 pending으로 매핑)
  const rawStatus = order?.status || 'pending';
  const status = rawStatus === 'paid' ? 'pending' : rawStatus;
  const isCancelled = status === 'cancelled';
  const visibleSteps = isCancelled ? STEPS.slice(0, 2) : STEPS;
  const curIdx = visibleSteps.findIndex(s => s.key === status);
  const curStep = isCancelled ? CANCELLED : (visibleSteps[curIdx] || visibleSteps[0]);
  const CurIcon = curStep.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-[70] cust-bg-card rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            <div className="w-12 h-1.5 bg-grey-200 dark:bg-white/10 rounded-full mx-auto my-3" />

            {/* 헤더 */}
            <div className="px-6 pb-4 flex items-center justify-between border-b cust-border">
              <div>
                <h2 className="tds-title cust-text-main">{t('order_status.title')}</h2>
                {order && (
                  <p className="tds-caption cust-text-sub mt-0.5">
                    {t('order_status.order_number', { number: order.order_number || order.id })}
                    {lastUpdated && (
                      <span className="ml-1 text-emerald-500">
                        · {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} {t('order_status.updated')}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button onClick={() => { vibrateClick(); onClose(); }} className="p-2 hover:bg-grey-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {loading && !order ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-4" />
                  <p className="tds-body cust-text-sub">{t('order_status.loading')}</p>
                </div>
              ) : !order ? (
                <EmptyState icon="📋" title={t('order_status.no_recent')} description={t('order_status.no_recent_desc')} />
              ) : (
                <div className="space-y-8">

                  {/* ── 진행 단계 ── */}
                  <div className="relative pt-2">
                    {/* 배경 연결선 */}
                    <div className="absolute top-8 left-6 right-6 h-0.5 bg-grey-100 dark:bg-white/5" />
                    {/* 진행 연결선 */}
                    {!isCancelled && (
                      <div
                        className="absolute top-8 left-6 h-0.5 bg-orange-400 transition-all duration-700"
                        style={{
                          width: curIdx <= 0
                            ? '0%'
                            : `${(curIdx / (STEPS.length - 1)) * (100 - 12)}%`
                        }}
                      />
                    )}

                    <div className="relative flex justify-between">
                      {visibleSteps.map((step, idx) => {
                        const Icon = step.icon;
                        const isPast = idx < curIdx;
                        const isCur = idx === curIdx;
                        return (
                          <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: `${100 / visibleSteps.length}%` }}>
                            <motion.div
                              animate={isCur ? { scale: [1, 1.12, 1] } : {}}
                              transition={{ duration: 1.8, repeat: Infinity }}
                              className={[
                                'w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white dark:bg-slate-800 z-10 transition-all',
                                isCur ? `ring-4 ${step.ring}/30 border-current ${step.color} ${step.bg}` :
                                isPast ? 'border-orange-400 bg-orange-400 text-white' :
                                'border-grey-200 dark:border-white/10 text-grey-300 dark:text-slate-700'
                              ].join(' ')}
                            >
                              {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </motion.div>
                            <span className={`text-[10px] font-black text-center leading-tight ${isCur ? step.color : isPast ? 'text-orange-400' : 'text-grey-300 dark:text-slate-700'}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── 현재 상태 배지 ── */}
                  <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl ${curStep.bg} dark:bg-white/5`}>
                    <CurIcon className={`w-6 h-6 ${curStep.color} flex-shrink-0`} />
                    <div>
                      <p className={`font-black text-sm ${curStep.color}`}>{curStep.label}</p>
                      <p className="text-xs cust-text-sub mt-0.5">{t(STATUS_MSG_KEYS[status]) || ''}</p>
                    </div>
                  </div>

                  {/* ── 예상 소요 시간(ETA) ── */}
                  {eta && !isCancelled && status !== 'completed' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">예상 소요 시간</p>
                        <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
                          {eta.etaMinutes}분
                        </p>
                      </div>
                      <p className="text-xs text-blue-500 dark:text-blue-500">
                        대기 주문 {eta.activeOrdersAhead}건
                      </p>
                    </motion.div>
                  )}

                  {/* ── 주문 상품 ── */}
                  <div>
                    <h3 className="text-xs font-black text-grey-400 dark:text-grey-600 uppercase tracking-widest mb-3">{t('order_status.details')}</h3>
                    <div className="bg-grey-50 dark:bg-white/5 rounded-2xl p-5 space-y-3">
                      {(order.items || order.order_items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="cust-text-main font-bold">
                            {item.product_name || item.name}
                            <span className="text-grey-400 dark:text-grey-600 font-normal"> × {item.quantity}</span>
                          </span>
                          <span className="cust-text-sub">
                            {formatWon((item.price || item.unit_price || 0) * item.quantity)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-3 border-t cust-border flex justify-between">
                        <span className="text-sm font-black cust-text-sub">{t('order_status.subtotal')}</span>
                        <span className="text-base font-black cust-text-main">{formatWon(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 cust-bg-card border-t cust-border space-y-3">
              {/* 준비완료/수령완료 주문은 리뷰 작성 유도 */}
              {onWriteReview && (status === 'ready' || status === 'completed') && (
                <button
                  onClick={() => { vibrateSuccess(); onWriteReview(order); }}
                  className="w-full h-14 bg-orange-500 text-white rounded-2xl font-black active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <BellRing className="w-5 h-5" aria-hidden="true" />
                  {t('order_status.review_cta')}
                </button>
              )}
              <button
                onClick={() => { vibrateClick(); onClose(); }}
                className="w-full h-14 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black active:scale-95 transition-transform"
              >
                {t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OrderStatusModal;

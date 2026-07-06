import { formatWon } from '../../utils/format';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, ChefHat, BellRing, Package, Loader2 } from 'lucide-react';
import { ordersAPI } from '@/api';
import { joinOrderRoom, onOrderUpdated } from '@/utils/socket';
import EmptyState from '../common/EmptyState';

const STEPS = [
  { key: 'pending',   label: '주문 접수',  icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-50',   ring: 'ring-amber-400' },
  { key: 'confirmed', label: '주문 확인',  icon: CheckCircle2,  color: 'text-blue-500',    bg: 'bg-blue-50',    ring: 'ring-blue-400' },
  { key: 'preparing', label: '조리 중',    icon: ChefHat,       color: 'text-purple-500',  bg: 'bg-purple-50',  ring: 'ring-purple-400' },
  { key: 'ready',     label: '준비 완료',  icon: BellRing,      color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  { key: 'completed', label: '수령 완료',  icon: Package,       color: 'text-grey-400',   bg: 'bg-grey-50',   ring: 'ring-grey-300' },
];
const CANCELLED = { key: 'cancelled', label: '주문 취소', icon: X, color: 'text-rose-500', bg: 'bg-rose-50', ring: 'ring-rose-400' };

const STATUS_MSG = {
  pending:   '주문을 접수했습니다. 잠시 기다려주세요.',
  confirmed: '매장에서 주문을 확인했습니다.',
  preparing: '맛있게 조리하고 있습니다! 🍳',
  ready:     '음식이 준비됐습니다. 수령해주세요! 🔔',
  completed: '이용해주셔서 감사합니다.',
  cancelled: '주문이 취소되었습니다.',
};


const OrderStatusModal = ({ isOpen, onClose, orderId, storeId, tableNumber, onWriteReview }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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

  // 모달 열릴 때 초기 로드
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

  const status = order?.status || 'pending';
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
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-[70] bg-white rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            <div className="w-12 h-1.5 bg-grey-200 rounded-full mx-auto my-3" />

            {/* 헤더 */}
            <div className="px-6 pb-4 flex items-center justify-between border-b border-grey-100">
              <div>
                <h2 className="tds-title text-grey-900">주문 현황</h2>
                {order && (
                  <p className="tds-caption text-grey-400 mt-0.5">
                    주문 #{order.order_number || order.id}
                    {lastUpdated && (
                      <span className="ml-1 text-emerald-500">
                        · {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 업데이트
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="p-2 hover:bg-grey-100 rounded-full">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {loading && !order ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-4" />
                  <p className="tds-body text-grey-500">주문 정보를 불러오는 중...</p>
                </div>
              ) : !order ? (
                <EmptyState icon="📋" title="최근 주문 내역이 없습니다" description="주문하시면 여기에서 진행 상태를 확인할 수 있어요." />
              ) : (
                <div className="space-y-8">

                  {/* ── 진행 단계 ── */}
                  <div className="relative pt-2">
                    {/* 배경 연결선 */}
                    <div className="absolute top-8 left-6 right-6 h-0.5 bg-grey-100" />
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
                                'w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white z-10 transition-all',
                                isCur ? `ring-4 ${step.ring}/30 border-current ${step.color} ${step.bg}` :
                                isPast ? 'border-orange-400 bg-orange-400 text-white' :
                                'border-grey-200 text-grey-300'
                              ].join(' ')}
                            >
                              {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </motion.div>
                            <span className={`text-[10px] font-black text-center leading-tight ${isCur ? step.color : isPast ? 'text-orange-400' : 'text-grey-300'}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}

                      {/* 취소 표시 */}
                      {isCancelled && (
                        <div className="flex flex-col items-center gap-2" style={{ width: `${100 / (visibleSteps.length + 1)}%` }}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white ${CANCELLED.bg} ${CANCELLED.color} border-rose-300 z-10`}>
                            <X className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-black text-center ${CANCELLED.color}`}>취소됨</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── 현재 상태 배지 ── */}
                  <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl ${curStep.bg}`}>
                    <CurIcon className={`w-6 h-6 ${curStep.color} flex-shrink-0`} />
                    <div>
                      <p className={`font-black text-sm ${curStep.color}`}>{curStep.label}</p>
                      <p className="text-xs text-grey-400 mt-0.5">{STATUS_MSG[status] || ''}</p>
                    </div>
                  </div>

                  {/* ── 주문 상품 ── */}
                  <div>
                    <h3 className="text-xs font-black text-grey-400 uppercase tracking-widest mb-3">주문 내역</h3>
                    <div className="bg-grey-50 rounded-2xl p-5 space-y-3">
                      {(order.items || order.order_items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-grey-700 font-bold">
                            {item.product_name || item.name}
                            <span className="text-grey-400 font-normal"> × {item.quantity}</span>
                          </span>
                          <span className="text-grey-500">
                            {formatWon((item.price || item.unit_price || 0) * item.quantity)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-3 border-t border-grey-200 flex justify-between">
                        <span className="text-sm font-black text-grey-700">합계</span>
                        <span className="text-base font-black text-grey-900">{formatWon(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 테이블 정보 */}
                  {(order.table_name || order.table_id) && (
                    <p className="text-sm text-grey-400">
                      <span className="font-bold text-grey-600">테이블: </span>
                      {order.table_name || `#${order.table_id}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-grey-100 space-y-3">
              {/* 준비완료/수령완료 주문은 리뷰 작성 유도 */}
              {onWriteReview && (status === 'ready' || status === 'completed') && (
                <button
                  onClick={() => onWriteReview(order)}
                  className="w-full h-14 bg-orange-500 text-white rounded-2xl font-black active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <BellRing className="w-5 h-5" aria-hidden="true" />
                  리뷰 작성하고 혜택 받기
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full h-14 bg-grey-900 text-white rounded-2xl font-black active:scale-95 transition-transform"
              >
                확인
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OrderStatusModal;

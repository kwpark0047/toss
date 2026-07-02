import { Eye, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatPrice } from '../../utils/format';

const OrderCard = ({ order, statusConfig, onShowDetail, onStatusChange, formatTime }) => {
  const config  = statusConfig[order.status];
  const StatusIcon = config.icon;
  const items   = order.items || [];
  const preview = items.slice(0, 4);
  const extra   = items.length - 4;

  /* 상태별 왼쪽 테두리 색 */
  const borderColor =
    order.status === 'pending'   ? 'border-amber-400' :
    order.status === 'confirmed' ? 'border-blue-400'  :
    order.status === 'preparing' ? 'border-purple-400' :
    order.status === 'ready'     ? 'border-emerald-400' :
    order.status === 'completed' ? 'border-slate-600' :
                                   'border-rose-400';

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-800/70 border border-white/6 border-l-4 ${borderColor} rounded-2xl overflow-hidden`}>

      {/* ─ 헤더 ─ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-black text-base">#{order.order_number}</span>
          {order.status === 'pending' && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          )}
        </div>
        {/* 상태 배지 */}
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${config.bg} ${config.border} ${config.color}`}>
          <StatusIcon size={11} />
          {config.label}
        </span>
      </div>

      {/* ─ 메타 (테이블·시간) ─ */}
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-1">
        <span className="flex items-center gap-1 text-slate-400 text-xs font-bold">
          <Clock size={11} className="flex-shrink-0" />
          {formatTime(order.created_at)}
        </span>
        {order.table_name && (
          <span className="flex items-center gap-1 text-slate-300 text-xs font-black">
            <MapPin size={11} className="flex-shrink-0 text-orange-400" />
            {order.table_name}
          </span>
        )}
        {order.customer_name && (
          <span className="flex items-center gap-1 text-slate-400 text-xs font-bold ml-auto">
            <User size={11} className="flex-shrink-0" />
            {order.customer_name}
          </span>
        )}
      </div>

      {/* ─ 주문 항목 ─ */}
      <div className="px-4 pt-2 pb-1 space-y-1.5">
        {preview.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* 수량 배지 */}
              <span className="flex-shrink-0 w-6 h-6 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-300 font-black text-xs">
                {item.quantity}
              </span>
              <span className="text-white font-bold text-base leading-tight truncate">
                {item.product_name}
              </span>
            </div>
            <span className="flex-shrink-0 text-slate-300 font-black text-sm">
              {formatPrice(item.price * item.quantity, true)}
            </span>
          </div>
        ))}
        {extra > 0 && (
          <p className="text-slate-500 text-xs font-bold pl-8">+ {extra}개 더</p>
        )}
      </div>

      {/* ─ 요청사항 ─ */}
      {order.notes && (
        <div className="mx-4 mt-2 px-3 py-2 bg-amber-500/8 border border-amber-500/15 rounded-xl">
          <p className="text-amber-300 text-xs font-bold leading-snug">💬 {order.notes}</p>
        </div>
      )}

      {/* ─ 하단: 금액 + 액션 ─ */}
      <div className="flex items-center justify-between px-4 py-3 mt-2 border-t border-white/5">
        <span className="text-white font-black text-lg">{formatPrice(order.total_amount, true)}</span>

        <div className="flex items-center gap-2">
          <button onClick={() => onShowDetail(order)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <Eye size={14} />
          </button>

          {config.next && (
            <button onClick={() => onStatusChange(order.id, config.next)}
              className={`h-8 px-3 rounded-lg flex items-center gap-1 font-black text-xs transition-all ${config.bg} ${config.border} ${config.color} hover:brightness-125 border`}>
              {statusConfig[config.next].label}
              <ChevronRight size={12} />
            </button>
          )}

          {order.status === 'pending' && (
            <button onClick={() => onStatusChange(order.id, 'cancelled')}
              className="h-8 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs hover:bg-rose-500/20 transition-all">
              취소
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;

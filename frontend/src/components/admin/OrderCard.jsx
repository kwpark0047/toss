import { Eye, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import Icon from '../ui/Icon';

const STATUS_STYLE = {
  paid:      { bar: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-700 border-teal-200',       btn: 'bg-teal-500 text-white' },
  pending:   { bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',   btn: 'bg-amber-500 text-white' },
  confirmed: { bar: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200',       btn: 'bg-blue-500 text-white' },
  preparing: { bar: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 border-purple-200', btn: 'bg-purple-500 text-white' },
  ready:     { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', btn: 'bg-emerald-500 text-white' },
  completed: { bar: 'bg-slate-300',   badge: 'bg-slate-50 text-slate-500 border-slate-200',    btn: 'bg-slate-400 text-white' },
  cancelled: { bar: 'bg-rose-400',    badge: 'bg-rose-50 text-rose-600 border-rose-200',       btn: 'bg-rose-500 text-white' },
};

const OrderCard = ({ order, statusConfig, onShowDetail, onStatusChange, formatTime }) => {
  // 알 수 없는 상태(예: 신규 결제완료 'paid' 등)에도 크래시하지 않도록 방어
  const config = statusConfig[order.status] || statusConfig.pending || { label: order.status, icon: Clock, next: null };
  const style  = STATUS_STYLE[order.status] || STATUS_STYLE.pending;
  const StatusIcon = config.icon || Clock;
  const isPending = order.status === 'pending' || order.status === 'paid';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 active:scale-[0.99] transition-transform"
    >
      {/* 상단 컬러 바 */}
      <div className={`h-1 ${style.bar}`} />

      {/* 주문 헤더 */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-gray-900 tracking-tight">
            #{order.order_number}
          </span>
          {isPending && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          )}
        </div>

        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${style.badge}`}>
          <StatusIcon size={12} />
          {config.label}
        </span>
      </div>

      {/* 메타 정보 (시간·테이블·고객) */}
      <div className="px-4 pb-2 flex items-center gap-3 text-sm text-gray-500 font-medium flex-wrap">
        <span className="flex items-center gap-1">
          <Clock size={13} className="text-gray-400" />
          {formatTime(order.created_at)}
        </span>
        {order.table_name && (
          <span className="flex items-center gap-1">
            <Icon icon="MapPin" />
            {order.table_name}
          </span>
        )}
        {order.customer_name && (
          <span className="flex items-center gap-1">
            <User size={13} className="text-gray-400" />
            {order.customer_name}
          </span>
        )}
      </div>

      {/* 주문 항목 */}
      <div className="px-4 py-2 border-t border-gray-50 space-y-1.5">
        {(order.items || []).slice(0, 4).map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-800 truncate mr-2">
              {item.product_name}
              <span className="text-gray-400 font-normal"> ×{item.quantity}</span>
            </span>
            <span className="text-sm font-bold text-gray-600 shrink-0">
              {formatPrice(item.price * item.quantity, true)}
            </span>
          </div>
        ))}
        {(order.items || []).length > 4 && (
          <p className="text-sm text-gray-400 font-medium">
            외 {order.items.length - 4}개 항목
          </p>
        )}
      </div>

      {/* 요청사항 */}
      {order.notes && (
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 leading-snug">✏️ {order.notes}</p>
        </div>
      )}

      {/* 하단: 금액 + 액션 버튼 */}
      <div className="px-4 pb-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="text-xl font-black text-gray-900">
          {formatPrice(order.total_amount, true)}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowDetail(order)}
            className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 active:scale-95"
            title="상세보기"
          >
            <Eye size={18} className="text-gray-600" />
          </button>

          {isPending && (
            <button
              onClick={() => onStatusChange(order.id, 'cancelled')}
              className="h-11 px-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold hover:bg-rose-100 transition-colors border border-rose-100 active:scale-95"
            >
              취소
            </button>
          )}

          {config.next && (
            <button
              onClick={() => onStatusChange(order.id, config.next)}
              className={`h-11 px-5 rounded-xl text-sm font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-transform ${style.btn}`}
            >
              {statusConfig[config.next].label}
              <ChevronRight size={16} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;

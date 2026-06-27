import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, ChefHat, BellRing } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ordersAPI } from '@/api';

const OrderStatusModal = ({ isOpen, onClose, storeId, tableNumber }) => {
  // 실제 주문 내역 조회 (데모용으로 최근 1시간 내역)
  const { data: orders = [] } = useQuery({
    queryKey: ["orderStatus", storeId, tableNumber],
    queryFn: async () => {
      // 실제 API는 tableNumber 기반 필터가 필요함
      const res = await ordersAPI.getByStore(storeId);
      // 테이블 번호와 일치하는 최근 주문만 필터링 (간소화)
      return res.filter(o => o.table_id == tableNumber).slice(0, 5);
    },
    enabled: isOpen && !!storeId,
    refetchInterval: 5000 // 5초마다 갱신
  });

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending': return { label: '대기 중', icon: <Clock className="text-amber-500" />, color: 'bg-amber-100' };
      case 'preparing': return { label: '조리 중', icon: <ChefHat className="text-blue-500" />, color: 'bg-blue-100' };
      case 'ready': return { label: '준비 완료', icon: <BellRing className="text-emerald-500 animate-bounce" />, color: 'bg-emerald-100 text-emerald-600 font-bold' };
      case 'completed': return { label: '수령 완료', icon: <CheckCircle2 className="text-slate-400" />, color: 'bg-slate-100 text-slate-500' };
      default: return { label: status, icon: <Clock className="text-slate-400" />, color: 'bg-slate-100' };
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-xl font-black text-slate-900">주문 현황</h2>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {orders.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-slate-400 font-medium">최근 주문 내역이 없습니다</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-slate-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Order #{order.id}</span>
                        <span className="text-xs text-slate-300">|</span>
                        <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${getStatusInfo(order.status).color}`}>
                        {getStatusInfo(order.status).icon}
                        <span>{getStatusInfo(order.status).label}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-700 font-bold">{item.product_name} x {item.quantity}</span>
                          <span className="text-slate-400">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-500">합계</span>
                      <span className="text-lg font-black text-slate-900">{formatPrice(order.total_amount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-white border-t border-slate-100">
              <button onClick={onClose} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black transition-transform active:scale-95">
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

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, CreditCard } from 'lucide-react';

const formatPhoneInput = (value) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const CartModal = ({ isOpen, onClose, cart, onUpdateQuantity, onOrder, isOrdering, totalPrice, notifyPhone = '', onNotifyPhoneChange }) => {
  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-50 bg-white rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-xl font-black text-slate-900">장바구니</h2>
              <button onClick={onClose} aria-label="닫기" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🛒</div>
                  <p className="text-slate-400 font-medium">장바구니가 비어 있습니다</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.cartItemId} className="flex gap-3">
                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">{item.menuItem.emoji || '🍽️'}</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center min-w-0 gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{item.menuItem.name}</h3>
                            <button 
                              onClick={() => onUpdateQuantity(item.cartItemId, -item.quantity)}
                              className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {item.selectedOptions?.length > 0 && (
                            <p className="text-[10px] text-slate-400 truncate">
                              {item.selectedOptions.map(opt => opt.choiceName).join(', ')}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">{formatPrice(item.unitPrice * item.quantity)}</span>
                            
                            <div className="flex items-center gap-2 bg-slate-100 rounded-full p-0.5">
                              <button 
                                onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-black w-3 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI 추천 섹션 */}
                  <div className="pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">✨</span>
                      <h4 className="font-black text-slate-800 text-sm">함께 먹으면 더 맛있는 인기 조합</h4>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide">
                      {[1, 2, 3].map((_, i) => (
                        <div key={i} className="min-w-[140px] p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex flex-col gap-1.5">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">🥤</div>
                          <div>
                            <p className="text-[10px] font-bold text-orange-600">추천 페어링</p>
                            <p className="text-xs font-black text-slate-900">시원한 에이드</p>
                            <p className="text-[10px] text-slate-500">4,500원</p>
                          </div>
                          <button className="w-full py-1.5 bg-white border border-orange-200 text-orange-600 text-[10px] font-bold rounded-lg hover:bg-orange-100 transition-colors">
                            추가하기
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-4 bg-slate-50 space-y-3">
              {/* 분할 결제 안내 팁 */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    <span className="text-[10px] font-bold">1/N</span>
                  </div>
                  <span className="text-xs font-bold text-blue-900">친구와 나누어 결제할까요?</span>
                </div>
                <button className="text-[10px] font-black text-blue-600 underline">분할 결제 설정</button>
              </div>

              {/* 알림 받을 번호 — 저장된 번호 자동 입력, 수정 가능 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <label htmlFor="notify-phone" className="block text-[10px] font-black text-slate-700 mb-1">
                  📱 주문 알림 받을 번호
                </label>
                <input
                  id="notify-phone"
                  type="tel"
                  inputMode="numeric"
                  value={notifyPhone}
                  onChange={(e) => onNotifyPhoneChange?.(formatPhoneInput(e.target.value))}
                  placeholder="010-0000-0000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {notifyPhone ? '저장된 번호가 입력되었어요. 다른 번호로 받으려면 수정하세요.' : '입력하시면 주문 상태를 문자로 안내받을 수 있어요. (선택)'}
                </p>
              </div>

              <div className="flex items-center justify-between text-slate-900 font-black text-lg">
                <span>총 결제금액</span>
                <span className="text-primary">{formatPrice(totalPrice)}</span>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={cart.length === 0 || isOrdering}
                onClick={onOrder}
                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-base shadow-lg shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all"
              >
                {isOrdering ? (
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard size={20} />
                    <span>주문하기</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartModal;

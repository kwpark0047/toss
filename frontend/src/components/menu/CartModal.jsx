import { formatWon } from '../../utils/format';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { X, Minus, Plus, Trash2, CreditCard, Sparkles, Banknote, Building2, Smartphone, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';

// ── 결제수단 정의 ──────────────────────────────────────────────────
// 간편결제 (모바일): 온라인 계정 기반 즉시 결제
// 일반결제 (오프라인): 매장 직접 결제 / 계좌 송금
const PAYMENT_GROUPS = [
  {
    id: 'easy',
    label: '간편결제',
    description: '앱으로 빠르게 결제',
    methods: [
      { id: 'toss',     label: '토스페이',     icon: Smartphone, desc: '모바일 앱으로 간편 결제',        brandColor: '#0064FF', bgClass: 'bg-blue-500' },
      { id: 'kakao',    label: '카카오페이',   icon: Smartphone, desc: '카카오톡으로 빠른 결제',         brandColor: '#FEE500', bgClass: 'bg-yellow-300', textColor: '#000000' },
      { id: 'naver',    label: '네이버페이',   icon: Smartphone, desc: '네이버로 간편 결제',             brandColor: '#03C75A', bgClass: 'bg-green-500' },
    ],
  },
  {
    id: 'standard',
    label: '일반결제',
    description: '매장에서 직접 결제',
    methods: [
      { id: 'cash',     label: '현금',         icon: Banknote,   desc: '직원에게 현금 직접 결제',        brandColor: '#16A34A', bgClass: 'bg-emerald-500' },
      { id: 'card',     label: '신용카드',     icon: CreditCard, desc: '카드 결제 후 직원 확인',         brandColor: '#0EA5E9', bgClass: 'bg-sky-500' },
      { id: 'transfer', label: '계좌이체',     icon: Building2,  desc: '매장 계좌 송금 후 확인',         brandColor: '#475569', bgClass: 'bg-slate-600' },
    ],
  },
];

// Flat map for quick lookup
const METHOD_MAP = Object.fromEntries(
  PAYMENT_GROUPS.flatMap(g => g.methods).map(m => [m.id, m])
);

const formatPhoneInput = (value) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const CartModal = ({ isOpen, onClose, cart, onUpdateQuantity, onOrder, isOrdering, totalPrice, notifyPhone = '', onNotifyPhoneChange, paymentMethod = 'card', onPaymentMethodChange, menuItems = [], storeId, onAddToCartClick }) => {
  const cartItemIds = new Set(cart.map(c => c.menuItem.id));

  // 카테고리별 첫 메뉴 아이템을 추천 (장바구니에 없는 카테고리 우선)
  const suggestions = (() => {
    if (!menuItems.length || !cart.length) return [];
    const cartCategoryIds = new Set(cart.map(c => c.menuItem.category_id));
    const cartItemIdsSet = cartItemIds;

    // 1순위: 장바구니에 없는 카테고리에서 인기/신규 메뉴
    const otherCats = menuItems.filter(
      m => m.is_active !== false && !m.is_sold_out && !cartItemIdsSet.has(m.id) && m.category_id && !cartCategoryIds.has(m.category_id)
    );
    // 2순위: 같은 카테고리지만 다른 메뉴
    const sameCats = menuItems.filter(
      m => m.is_active !== false && !m.is_sold_out && !cartItemIdsSet.has(m.id) && m.category_id && cartCategoryIds.has(m.category_id)
    );

    const pick = [...otherCats, ...sameCats];
    // is_popular 우선, sort_order 순
    pick.sort((a, b) => (b.is_popular || 0) - (a.is_popular || 0) || (a.sort_order || 999) - (b.sort_order || 999));
    return pick.slice(0, 3);
  })();

  const selectedMethodData = METHOD_MAP[paymentMethod];
  const selectedGroup = PAYMENT_GROUPS.find(g => g.methods.some(m => m.id === paymentMethod));

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
            <div className="w-12 h-1.5 bg-grey-200 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b border-grey-50">
              <h2 className="text-xl font-black text-grey-900">장바구니</h2>
              <button onClick={onClose} aria-label="닫기" className="p-2 hover:bg-grey-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {cart.length === 0 ? (
                <EmptyState icon="🛒" title="장바구니가 비어 있습니다" description="메뉴를 담아 주문을 시작해 보세요." />
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.cartItemId} className="flex gap-3">
                        {/* Leading — 메뉴 이미지 또는 emoji */}
                        <div className="relative w-16 h-16 rounded-xl bg-grey-50 border border-grey-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.menuItem.image_url ? (
                            <img
                              src={item.menuItem.image_url}
                              alt={item.menuItem.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <span
                            className={`text-2xl ${item.menuItem.image_url ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}
                          >
                            {item.menuItem.emoji || '🍽️'}
                          </span>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center min-w-0 gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-grey-900 text-sm leading-tight truncate">{item.menuItem.name}</h3>
                            <button 
                              onClick={() => onUpdateQuantity(item.cartItemId, -item.quantity)}
                              className="text-grey-300 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {item.selectedOptions?.length > 0 && (
                            <p className="text-[10px] text-grey-400 truncate">
                              {item.selectedOptions.map(opt => opt.choiceName).join(', ')}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-grey-900">{formatWon(item.unitPrice * item.quantity)}</span>
                            
                            <div className="flex items-center gap-2 bg-grey-100 rounded-full p-0.5">
                              <button 
                                onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-grey-600 shadow-sm active:scale-90 transition-transform"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-black w-3 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-grey-600 shadow-sm active:scale-90 transition-transform"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 함께 먹으면 더 맛있는 인기조합 — 실제 메뉴 기반 */}
                  {suggestions.length > 0 && (
                    <div className="pt-5 border-t border-grey-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-orange-400" />
                        <h4 className="font-black text-grey-800 text-sm">함께 먹으면 더 맛있는 인기조합</h4>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide">
                        {suggestions.map((menuItem) => (
                          <div key={menuItem.id} className="min-w-[140px] max-w-[140px] p-3 bg-gradient-to-b from-orange-50/80 to-white rounded-2xl border border-orange-100/50 flex flex-col gap-1.5">
                            {/* 이미지 또는 emoji */}
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-orange-100/50">
                              {menuItem.image_url ? (
                                <img src={menuItem.image_url} alt={menuItem.name} loading="lazy" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xl">{menuItem.emoji || '🍽️'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-orange-600">
                                {menuItem.is_popular ? '인기 메뉴' : '추천 페어링'}
                              </p>
                              <p className="text-xs font-black text-grey-900 truncate">{menuItem.name}</p>
                              <p className="text-[10px] text-grey-500">{formatWon(menuItem.price)}</p>
                            </div>
                            <button
                              onClick={() => onAddToCartClick?.(menuItem)}
                              className="w-full py-1.5 bg-white border border-orange-200 text-orange-600 text-[10px] font-bold rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
                            >
                              추가하기
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* === 하단: 결제 영역 === */}
            <div className="px-4 py-4 bg-grey-50 space-y-3">
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
              <div className="p-3 bg-white rounded-xl border border-grey-200">
                <label htmlFor="notify-phone" className="block text-[10px] font-black text-grey-700 mb-1">
                  📱 주문 알림 받을 번호
                </label>
                <input
                  id="notify-phone"
                  type="tel"
                  inputMode="numeric"
                  value={notifyPhone}
                  onChange={(e) => onNotifyPhoneChange?.(formatPhoneInput(e.target.value))}
                  placeholder="010-0000-0000"
                  className="w-full bg-grey-50 border border-grey-200 rounded-xl px-3 py-2.5 text-xs font-bold text-grey-900 placeholder:text-grey-400 outline-none focus:border-primary"
                />
                <p className="text-[10px] text-grey-400 mt-1">
                  {notifyPhone ? '저장된 번호가 입력되었어요. 다른 번호로 받으려면 수정하세요.' : '입력하시면 주문 상태를 문자로 안내받을 수 있어요. (선택)'}
                </p>
              </div>

              {/* === 결제 수단 선택 (고도화) === */}
              <LayoutGroup>
                <div className="bg-white rounded-xl border border-grey-200 overflow-hidden">
                  <div className="px-3 pt-3 pb-2">
                    <label className="block text-[10px] font-black text-grey-700">
                      💳 결제 수단 선택
                    </label>
                  </div>

                  {PAYMENT_GROUPS.map((group) => (
                    <div key={group.id} className="px-3 pb-2">
                      {/* 그룹 헤더 */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-black text-grey-500 uppercase tracking-wider">{group.label}</span>
                        <span className="text-[9px] text-grey-400">{group.description}</span>
                      </div>

                      {/* 그룹 내 결제수단 카드 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {group.methods.map((method) => {
                          const isSelected = paymentMethod === method.id;
                          const Icon = method.icon;
                          return (
                            <motion.button
                              key={method.id}
                              layout
                              layoutId={`payment-card-${method.id}`}
                              onClick={() => onPaymentMethodChange(method.id)}
                              className={`relative flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-grey-900 bg-grey-50 shadow-sm'
                                  : 'border-transparent bg-grey-50/50 hover:bg-grey-100/70'
                              }`}
                            >
                              {/* 선택 시 상단 브랜드 컬러 바 */}
                              {isSelected && (
                                <motion.div
                                  layoutId={`payment-bar-${method.id}`}
                                  className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
                                  style={{ backgroundColor: method.brandColor }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                              )}

                              {/* 브랜드 컬러 아이콘 래퍼 */}
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'shadow-sm'
                                    : 'opacity-60'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? `${method.brandColor}15` : 'transparent',
                                  color: method.brandColor,
                                }}
                              >
                                <Icon size={16} />
                              </div>

                              {/* 결제수단명 + 설명 */}
                              <div className="min-w-0 w-full">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[11px] font-black leading-tight transition-colors ${
                                    isSelected ? 'text-grey-900' : 'text-grey-600'
                                  }`}>
                                    {method.label}
                                  </span>
                                  {isSelected && (
                                    <motion.span
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    >
                                      <CheckCircle2 size={12} className="text-grey-900" />
                                    </motion.span>
                                  )}
                                </div>
                                <p className={`text-[9px] leading-tight mt-0.5 transition-colors ${
                                  isSelected ? 'text-grey-500' : 'text-grey-400'
                                }`}>
                                  {method.desc}
                                </p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </LayoutGroup>

              {/* 결제 요약: 선택된 수단 + 총 금액 */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-grey-200">
                {selectedMethodData && selectedGroup ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${selectedMethodData.brandColor}15`, color: selectedMethodData.brandColor }}
                    >
                      <selectedMethodData.icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-grey-700 truncate">
                        {selectedGroup.label} · {selectedMethodData.label}
                      </p>
                      <p className="text-[9px] text-grey-400 truncate">{selectedMethodData.desc}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-grey-400">결제 수단을 선택해주세요</span>
                )}
                <span className="text-base font-black text-primary flex-shrink-0 ml-2">{formatWon(totalPrice)}</span>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isOrdering}
                disabled={cart.length === 0}
                onClick={onOrder}
              >
                {(() => {
                  const methodData = paymentMethod && METHOD_MAP[paymentMethod];
                  if (methodData) {
                    const Icon = methodData.icon;
                    return (<><Icon size={18} /><span>{methodData.label}으로 주문하기</span></>);
                  }
                  return (<><CreditCard size={20} /><span>주문하기</span></>);
                })()}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartModal;

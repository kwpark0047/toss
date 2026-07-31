import { formatWon } from '../../utils/format';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { X, Minus, Plus, Trash2, CreditCard, Sparkles, Banknote, Building2, Smartphone, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import { vibrateClick } from '../../utils/notificationSound';
import LazyImage from '../common/LazyImage';

// ── 결제수단 정의 (번역 함수로 생성) ────────────────────────────────
const getPaymentGroups = (t) => [
  {
    id: 'easy',
    label: t('cart_modal.easy_payment'),
    description: t('cart_modal.easy_payment_desc'),
    methods: [
      { id: 'toss',     label: '토스페이',     icon: Smartphone, desc: t('cart_modal.toss_pay_desc'),   brandColor: '#0064FF', bgClass: 'bg-blue-500', available: true },
      // 카카오/네이버페이는 아직 PG 가맹 미완료 — 선택 불가 처리 (현재 이용 불가 라벨 노출)
      { id: 'kakao',    label: '카카오페이',   icon: Smartphone, desc: t('cart_modal.kakao_pay_desc'),  brandColor: '#FEE500', bgClass: 'bg-yellow-300', textColor: '#000000', available: false },
      { id: 'naver',    label: '네이버페이',   icon: Smartphone, desc: t('cart_modal.naver_pay_desc'),  brandColor: '#03C75A', bgClass: 'bg-green-500', available: false },
    ],
  },
  {
    id: 'standard',
    label: t('cart_modal.standard_payment'),
    description: t('cart_modal.standard_payment_desc'),
    methods: [
      { id: 'cash',     label: '현금',         icon: Banknote,   desc: t('cart_modal.cash_desc'),       brandColor: '#16A34A', bgClass: 'bg-emerald-500', available: true },
      { id: 'card',     label: '신용카드',     icon: CreditCard, desc: t('cart_modal.card_desc'),       brandColor: '#0EA5E9', bgClass: 'bg-sky-500', available: true },
      { id: 'transfer', label: '계좌이체',     icon: Building2,  desc: t('cart_modal.transfer_desc'),   brandColor: '#475569', bgClass: 'bg-slate-600', available: true },
    ],
  },
];

const formatPhoneInput = (value) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const CartModal = ({ isOpen, onClose, cart, onUpdateQuantity, onOrder, isOrdering, totalPrice, notifyPhone = '', onNotifyPhoneChange, paymentMethod = 'card', onPaymentMethodChange, menuItems = [], _storeId, onAddToCartClick }) => {
  const { t } = useTranslation();
  const PAYMENT_GROUPS = getPaymentGroups(t);
  const METHOD_MAP = Object.fromEntries(
    PAYMENT_GROUPS.flatMap(g => g.methods).map(m => [m.id, m])
  );
  const cartItemIds = new Set(cart.map(c => c.menuItem.id));

  const suggestions = (() => {
    if (!menuItems.length || !cart.length) return [];
    const cartCategoryIds = new Set(cart.map(c => c.menuItem.category_id));
    const cartItemIdsSet = cartItemIds;

    const otherCats = menuItems.filter(
      m => m.is_active !== false && !m.is_sold_out && !cartItemIdsSet.has(m.id) && m.category_id && !cartCategoryIds.has(m.category_id)
    );
    const sameCats = menuItems.filter(
      m => m.is_active !== false && !m.is_sold_out && !cartItemIdsSet.has(m.id) && m.category_id && cartCategoryIds.has(m.category_id)
    );

    const pick = [...otherCats, ...sameCats];
    pick.sort((a, b) => (b.is_popular || 0) - (a.is_popular || 0) || (a.sort_order || 999) - (b.sort_order || 999));
    return pick.slice(0, 3);
  })();

  const selectedMethodData = METHOD_MAP[paymentMethod];
  const selectedGroup = PAYMENT_GROUPS.find(g => g.methods.some(m => m.id === paymentMethod));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] z-50 cust-bg-card rounded-t-[32px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bottom-sheet"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-grey-200 dark:bg-white/10 rounded-full mx-auto my-3" />
            
            <div className="px-6 pb-4 flex items-center justify-between border-b cust-border">
              <h2 className="text-xl font-black cust-text-main">{t('cart_modal.title')}</h2>
              <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-grey-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6 text-grey-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {cart.length === 0 ? (
                <EmptyState icon="🛒" title={t('cart_modal.empty_title')} description={t('cart_modal.empty_desc')} />
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.cartItemId} className="flex gap-3">
                        {/* Leading — 메뉴 이미지 (LazyImage 적용) */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <LazyImage 
                            src={item.menuItem.image_url} 
                            alt={item.menuItem.name} 
                            placeholderEmoji={item.menuItem.emoji || '🍽️'}
                            className="rounded-xl"
                          />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center min-w-0 gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold cust-text-main text-sm leading-tight truncate">{item.menuItem.name}</h3>
                            <button 
                              onClick={() => {
                                vibrateClick();
                                onUpdateQuantity(item.cartItemId, -item.quantity);
                              }}
                              className="text-grey-300 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {item.selectedOptions?.length > 0 && (
                            <p className="text-[10px] cust-text-sub truncate">
                              {item.selectedOptions.map(opt => opt.choiceName).join(', ')}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold cust-text-main">{formatWon(item.unitPrice * item.quantity)}</span>
                            
                            <div className="flex items-center gap-2 bg-grey-100 dark:bg-white/5 rounded-full p-0.5">
                              <button 
                                onClick={() => {
                                  vibrateClick();
                                  onUpdateQuantity(item.cartItemId, -1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-grey-600 dark:text-slate-300 shadow-sm active:scale-90 transition-transform"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-black w-3 text-center cust-text-main">{item.quantity}</span>
                              <button 
                                onClick={() => {
                                  vibrateClick();
                                  onUpdateQuantity(item.cartItemId, 1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-grey-600 dark:text-slate-300 shadow-sm active:scale-90 transition-transform"
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
                    <div className="pt-5 border-t cust-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-orange-400" />
                        <h4 className="font-black cust-text-main text-sm">{t('cart_modal.popular_combo')}</h4>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide">
                        {suggestions.map((menuItem) => (
                          <div key={menuItem.id} className="min-w-[140px] max-w-[140px] p-3 bg-gradient-to-b from-orange-50/80 to-white dark:from-white/5 dark:to-white/10 rounded-2xl border border-orange-100/50 dark:border-white/5 flex flex-col gap-1.5">
                            {/* 이미지 (LazyImage 적용) */}
                            <div className="w-10 h-10 shrink-0">
                              <LazyImage 
                                src={menuItem.image_url} 
                                alt={menuItem.name} 
                                placeholderEmoji={menuItem.emoji || '🍽️'}
                                className="rounded-xl shadow-sm border border-orange-100/50 dark:border-white/5"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-orange-600">
                                {menuItem.is_popular ? t('cart_modal.popular_menu') : t('cart_modal.recommended_pairing')}
                              </p>
                              <p className="text-xs font-black cust-text-main truncate">{menuItem.name}</p>
                              <p className="text-[10px] cust-text-sub">{formatWon(menuItem.price)}</p>
                            </div>
                            <button
                              onClick={() => {
                                vibrateClick();
                                onAddToCartClick?.(menuItem);
                              }}
                              className="w-full py-1.5 bg-white dark:bg-white/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
                            >
                              {t('cart_modal.add')}
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
            <div className="px-4 py-4 bg-grey-50 dark:bg-black/20 space-y-3">
              {/* 분할 결제 안내 팁 */}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    <span className="text-[10px] font-bold">1/N</span>
                  </div>
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300">{t('cart_modal.split_payment')}</span>
                </div>
                <button className="text-[10px] font-black text-blue-600 dark:text-blue-400 underline">{t('cart_modal.split_payment_setting')}</button>
              </div>

              {/* 알림 받을 번호 */}
              <div className="p-3 cust-bg-card rounded-xl border cust-border">
                <label htmlFor="notify-phone" className="block text-[10px] font-black cust-text-sub mb-1">
                  📱 {t('cart_modal.notify_phone')}
                </label>
                <input
                  id="notify-phone"
                  type="tel"
                  inputMode="numeric"
                  value={notifyPhone}
                  onChange={(e) => onNotifyPhoneChange?.(formatPhoneInput(e.target.value))}
                  placeholder="010-0000-0000"
                  className="w-full bg-grey-50 dark:bg-white/5 border border-grey-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold cust-text-main placeholder:text-grey-400 outline-none focus:border-primary"
                />
                <p className="text-[10px] text-grey-400 mt-1">
                  {notifyPhone ? t('cart_modal.notify_phone_saved') : t('cart_modal.notify_phone_hint')}
                </p>
              </div>

              {/* === 결제 수단 선택 === */}
              <LayoutGroup>
                <div className="cust-bg-card rounded-xl border cust-border overflow-hidden">
                  <div className="px-3 pt-3 pb-2">
                    <label className="block text-[10px] font-black cust-text-sub">
                      💳 {t('cart_modal.select_payment')}
                    </label>
                  </div>

                  {PAYMENT_GROUPS.map((group) => (
                    <div key={group.id} className="px-3 pb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-black text-grey-500 dark:text-grey-600 uppercase tracking-wider">{group.label}</span>
                        <span className="text-[9px] text-grey-400">{group.description}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {group.methods.map((method) => {
                          const isSelected = paymentMethod === method.id;
                          const isUnavailable = method.available === false;
                          const Icon = method.icon;
                          const accessibleLabel = isUnavailable
                            ? `${method.label} (현재 이용 불가)`
                            : method.label;
                          return (
                            <motion.button
                              key={method.id}
                              layout
                              layoutId={`payment-card-${method.id}`}
                              disabled={isUnavailable}
                              aria-label={accessibleLabel}
                              onClick={() => {
                                if (isUnavailable) return;
                                vibrateClick();
                                onPaymentMethodChange(method.id);
                              }}
                              className={`relative flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 text-left transition-all ${
                                isUnavailable
                                  ? 'border-transparent bg-grey-50/40 dark:bg-white/5 opacity-60 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-grey-900 dark:border-white/40 bg-grey-50 dark:bg-white/10 shadow-sm'
                                    : 'border-transparent bg-grey-50/50 dark:bg-white/5 hover:bg-grey-100/70 dark:hover:bg-white/10'
                              }`}
                            >
                              {isSelected && (
                                <motion.div
                                  layoutId={`payment-bar-${method.id}`}
                                  className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
                                  style={{ backgroundColor: method.brandColor }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                              )}

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

                              <div className="min-w-0 w-full">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-[11px] font-black leading-tight transition-colors ${
                                    isSelected ? 'cust-text-main' : 'text-grey-600 dark:text-grey-500'
                                  }`}>
                                    {method.label}
                                  </span>
                                  {isSelected && (
                                    <motion.span
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    >
                                      <CheckCircle2 size={12} className="cust-text-main" />
                                    </motion.span>
                                  )}
                                </div>
                                {isUnavailable && (
                                  <span className="block text-[9px] font-bold text-grey-400 mt-0.5">
                                    현재 준비 중입니다
                                  </span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </LayoutGroup>

              {/* 결제 요약 */}
              <div className="flex items-center justify-between p-3 cust-bg-card rounded-xl border cust-border">
                {selectedMethodData && selectedGroup ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${selectedMethodData.brandColor}15`, color: selectedMethodData.brandColor }}
                    >
                      <selectedMethodData.icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black cust-text-main truncate">
                        {selectedGroup.label} · {selectedMethodData.label}
                      </p>
                      <p className="text-[9px] text-grey-400 truncate">{selectedMethodData.desc}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-grey-400">{t('cart_modal.select_payment_guide')}</span>
                )}
                <span className="text-base font-black text-primary flex-shrink-0 ml-2">{formatWon(totalPrice)}</span>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isOrdering}
                disabled={cart.length === 0}
                onClick={() => {
                  vibrateClick();
                  onOrder();
                }}
              >
                {(() => {
                  const methodData = paymentMethod && METHOD_MAP[paymentMethod];
                  if (methodData) {
                    const Icon = methodData.icon;
                    return (<><Icon size={18} /><span>{t('cart_modal.order_with_method', { method: methodData.label })}</span></>);
                  }
                  return (<><CreditCard size={20} /><span>{t('cart_modal.title')}</span></>);
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

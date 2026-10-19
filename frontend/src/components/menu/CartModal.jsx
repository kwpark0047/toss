import React, { useMemo, useState } from 'react';
import { formatWon } from '../../utils/format';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/ui/Icon';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import { vibrateClick } from '../../utils/notificationSound';
import LazyImage from '../common/LazyImage';
import TogetherPaymentSheet from '../customer/payment/TogetherPaymentSheet';
import { formatCustomerPhone, isValidCustomerMobilePhone } from '../../utils/customerPhone';

// ── 결제수단 정의 (번역 함수로 생성) ────────────────────────────────
const getPaymentGroups = (t) => [
  {
    id: 'easy',
    label: t('cart_modal.easy_payment'),
    description: t('cart_modal.easy_payment_desc'),
    methods: [
      { id: 'toss',     label: '토스페이',     icon: 'Smartphone', desc: t('cart_modal.toss_pay_desc'),   brandColor: '#0064FF', available: true },
      { id: 'kakao',    label: '카카오페이',   icon: 'Smartphone', desc: t('cart_modal.kakao_pay_desc'),  brandColor: '#FEE500', available: true },
      { id: 'naver',    label: '네이버페이',   icon: 'Smartphone', desc: t('cart_modal.naver_pay_desc'),  brandColor: '#03C75A', available: true },
    ],
  },
  {
    id: 'standard',
    label: t('cart_modal.standard_payment'),
    description: t('cart_modal.standard_payment_desc'),
    methods: [
      { id: 'cash',     label: '현금',         icon: 'Banknote',   desc: t('cart_modal.cash_desc'),       brandColor: '#16A34A', available: true },
      { id: 'card',     label: '신용카드',     icon: 'CreditCard', desc: t('cart_modal.card_desc'),       brandColor: '#0EA5E9', available: true },
      { id: 'transfer', label: '계좌이체',     icon: 'Building2',  desc: t('cart_modal.transfer_desc'),   brandColor: '#475569', available: true },
    ],
  },
];

const CartModal = ({ isOpen, onClose, cart, onUpdateQuantity, onOrder, onSplitPayment, isOrdering, totalPrice, notifyPhone = '', onNotifyPhoneChange, paymentMethod = 'card', onPaymentMethodChange, menuItems = [], _storeId, onAddToCartClick }) => {
  const { t } = useTranslation();
  const [compact, setCompact] = useState(false);
  const [isSplitPaymentOpen, setIsSplitPaymentOpen] = useState(false);
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
  const phoneIsValid = !notifyPhone || isValidCustomerMobilePhone(notifyPhone);
  const splitCart = useMemo(() => cart.map(item => ({
    product_id: item.menuItem.id,
    product_name: item.menuItem.name,
    price: item.unitPrice,
    quantity: item.quantity,
    cart_item_id: item.cartItemId,
  })), [cart]);
  const closeCart = () => {
    setCompact(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {!compact && <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />}

          {compact ? (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              role="region"
              aria-label={t('cart_modal.title')}
              className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:bg-slate-900/95"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold cust-text-main">{t('cart_modal.title')} · {cart.reduce((sum, item) => sum + item.quantity, 0)}{t('cart_modal.items_unit')}</p>
                <p className="text-sm font-black text-primary">{formatWon(totalPrice)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setCompact(false)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {t('cart_modal.open_cart')}
                </button>
                <button type="button" aria-label={t('common.close')} onClick={closeCart} className="rounded-full p-2 text-grey-500 hover:bg-grey-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <Icon icon="X" size="md" />
                </button>
              </div>
            </motion.div>
          ) : <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('cart_modal.title')}
            className="fixed inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[32px] shadow-2xl cust-bg-card bottom-sheet"
          >
            {/* Handle */}
            <div className="relative flex h-8 shrink-0 items-center justify-center">
              <div className="w-12 h-1.5 bg-grey-200 dark:bg-white/10 rounded-full" />
              <button
                type="button"
                aria-label={t('cart_modal.minimize')}
                onClick={() => setCompact(true)}
                className="absolute right-3 rounded-lg px-2 py-1 text-xs font-semibold text-grey-500 hover:bg-grey-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {t('cart_modal.minimize')}
              </button>
            </div>
            
            <div className="tds-stack-h tds-gap-4 tds-p-6 tds-p-4 items-center justify-between border-b cust-border">
              <h2 className="tds-text-bold text-xl cust-text-main">{t('cart_modal.title')}</h2>
              <button onClick={closeCart} aria-label={t('common.close')} className="tds-p-2 hover:bg-grey-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <Icon icon="X" size="md" />
              </button>
            </div>

            <div className="tds-stack tds-gap-4 tds-p-4 tds-p-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {cart.length === 0 ? (
                <EmptyState icon="🛒" title={t('cart_modal.empty_title')} description={t('cart_modal.empty_desc')} />
              ) : (
                <>
                  <div className="tds-stack tds-gap-4">
                    {cart.map((item) => (
                      <div key={item.cartItemId} className="tds-stack-h tds-gap-3">
                        {/* Leading — 메뉴 이미지 (LazyImage 적용) */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <LazyImage 
                            src={item.menuItem.image_url} 
                            alt={item.menuItem.name} 
                            placeholderEmoji={item.menuItem.emoji || '🍽️'}
                            className="rounded-xl"
                          />
                        </div>
                        
                        <div className="tds-stack tds-gap-1 flex-1 tds-stack-h flex-col justify-center min-w-0 tds-gap-1">
                          <div className="tds-stack-h tds-gap-2 items-start justify-between">
                            <h3 className="tds-text-bold cust-text-main text-sm leading-tight truncate">{item.menuItem.name}</h3>
                            <button 
                              type="button"
                              aria-label={t('cart_modal.remove_item', { name: item.menuItem.name })}
                              onClick={() => {
                                vibrateClick();
                                onUpdateQuantity(item.cartItemId, -item.quantity);
                              }}
                              className="text-grey-300 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Icon icon="Trash2" size="md" />
                            </button>
                          </div>
                          {item.selectedOptions?.length > 0 && (
                            <p className="tds-small cust-text-sub truncate">
                              {item.selectedOptions.map(opt => opt.choiceName).join(', ')}
                            </p>
                          )}
                          
                          <div className="tds-stack-h tds-gap-2 items-center justify-between">
                            <span className="tds-text-bold text-sm cust-text-main">{formatWon(item.unitPrice * item.quantity)}</span>
                            
                            <div className="tds-stack-h tds-gap-2 items-center bg-grey-100 dark:bg-white/5 rounded-full tds-p-1 tds-p-0.5">
                              <button 
                                type="button"
                                aria-label={t('cart_modal.decrease_quantity', { name: item.menuItem.name })}
                                onClick={() => {
                                  vibrateClick();
                                  onUpdateQuantity(item.cartItemId, -1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 tds-stack items-center justify-center text-grey-600 dark:text-slate-300 shadow-sm active:scale-90 transition-transform"
                              >
                                <Icon icon="Minus" size="md" />
                              </button>
                              <span className="tds-small font-black w-3 text-center cust-text-main">{item.quantity}</span>
                              <button 
                                type="button"
                                aria-label={t('cart_modal.increase_quantity', { name: item.menuItem.name })}
                                onClick={() => {
                                  vibrateClick();
                                  onUpdateQuantity(item.cartItemId, 1);
                                }}
                                className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 tds-stack items-center justify-center text-grey-600 dark:text-slate-300 shadow-sm active:scale-90 transition-transform"
                              >
                                <Icon icon="Plus" size="md" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 함께 먹으면 더 맛있는 인기조합 — 실제 메뉴 기반 */}
                  {suggestions.length > 0 && (
                    <div className="tds-p-5 tds-p-0 border-t cust-border">
                      <div className="tds-stack-h tds-gap-2 mb-3">
                        <Icon icon="Sparkles" size="md" />
                        <h4 className="tds-text-bold tds-text cust-text-main">{t('cart_modal.popular_combo')}</h4>
                      </div>
                      <div className="tds-stack-h tds-gap-3 overflow-x-auto tds-p-3 tds-p-2 -mx-2 scrollbar-hide">
                        {suggestions.map((menuItem) => (
                          <div key={menuItem.id} className="min-w-[140px] max-w-[140px] tds-p-3 bg-gradient-to-b from-orange-50/80 to-white dark:from-white/5 dark:to-white/10 rounded-2xl border border-orange-100/50 dark:border-white/5 tds-stack flex-col tds-gap-1.5">
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
                              <p className="tds-small font-bold text-orange-600">
                                {menuItem.is_popular ? t('cart_modal.popular_menu') : t('cart_modal.recommended_pairing')}
                              </p>
                              <p className="tds-small tds-text-bold cust-text-main truncate">{menuItem.name}</p>
                              <p className="tds-small cust-text-sub">{formatWon(menuItem.price)}</p>
                            </div>
                            <button
                              onClick={() => {
                                vibrateClick();
                                onAddToCartClick?.(menuItem);
                              }}
                              className="w-full tds-p-1 tds-p-1.5 bg-white dark:bg-white/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 tds-small font-bold rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
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
            <div className="tds-p-4 tds-p-3 tds-stack tds-gap-3 bg-grey-50 dark:bg-black/20">
              {/* 분할 결제 안내 팁 */}
              <div className="tds-stack-h tds-gap-2 tds-p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                <div className="tds-stack-h tds-gap-2 items-center">
                  <div className="w-7 h-7 bg-blue-500 rounded-full tds-stack items-center justify-center text-white">
                    <span className="tds-small font-bold">1/N</span>
                  </div>
                  <span className="tds-small font-bold text-blue-900 dark:text-blue-300">{t('cart_modal.split_payment')}</span>
                </div>
                <button
                  type="button"
                  disabled={cart.length === 0 || isOrdering || paymentMethod !== 'card'}
                  onClick={() => setIsSplitPaymentOpen(true)}
                  className="tds-small font-bold text-blue-600 dark:text-blue-400 underline disabled:cursor-not-allowed disabled:opacity-50"
                >{t('cart_modal.split_payment_setting')}</button>
              </div>
              {paymentMethod !== 'card' && (
                <p className="-mt-2 text-xs text-grey-500">{t('cart_modal.split_payment_card_only')}</p>
              )}

              {/* 알림 받을 번호 */}
              <div className="tds-p-3 cust-bg-card rounded-xl border cust-border">
                <label htmlFor="notify-phone" className="tds-small font-black cust-text-sub mb-1 block">
                  <Icon icon="Smartphone" size="md" /> {t('cart_modal.notify_phone')}
                </label>
                <input
                  id="notify-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={13}
                  value={notifyPhone}
                  aria-invalid={!phoneIsValid}
                  aria-describedby="notify-phone-help"
                  onChange={(e) => onNotifyPhoneChange?.(formatCustomerPhone(e.target.value))}
                  placeholder="010-0000-0000"
                  className={`w-full rounded-xl border bg-grey-50 tds-p-3 tds-p-2.5 tds-small font-bold cust-text-main outline-none placeholder:text-grey-400 dark:bg-white/5 dark:border-white/10 ${phoneIsValid ? 'border-grey-200 focus:border-primary' : 'border-red-500 focus:border-red-500'}`} />
                <p id="notify-phone-help" className={`tds-small mt-1 ${phoneIsValid ? 'text-grey-400' : 'text-red-600'}`}>
                  {notifyPhone ? (phoneIsValid ? t('cart_modal.notify_phone_saved') : t('cart_modal.notify_phone_invalid')) : t('cart_modal.notify_phone_hint')}
                </p>
              </div>

              {/* === 결제 수단 선택 === */}
              <LayoutGroup>
                <div className="cust-bg-card rounded-xl border cust-border overflow-hidden">
                  <div className="tds-p-3 tds-p-2">
                    <label className="tds-small font-black cust-text-sub block">
                      <Icon icon="CreditCard" size="md" /> {t('cart_modal.select_payment')}
                    </label>
                  </div>

                  {PAYMENT_GROUPS.map((group) => (
                    <div key={group.id} className="tds-p-3 tds-p-2">
                      <div className="tds-stack-h tds-gap-1.5 mb-1.5 items-center">
                        <span className="tds-small font-black text-grey-500 dark:text-grey-600 uppercase tracking-wider">{group.label}</span>
                        <span className="tds-caption text-grey-400">{group.description}</span>
                      </div>

                      <div className="tds-stack-h tds-gap-1.5 grid grid-cols-3">
                        {group.methods.map((method) => {
                          const isSelected = paymentMethod === method.id;
                          const isUnavailable = method.available === false;
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
                              className={`tds-stack tds-gap-1.5 tds-p-2 tds-p-2.5 rounded-xl border-2 text-left transition-all ${
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
                                className={`w-8 h-8 rounded-lg tds-stack items-center justify-center transition-all ${
                                  isSelected
                                    ? 'shadow-sm'
                                    : 'opacity-60'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? `${method.brandColor}15` : 'transparent',
                                  color: method.brandColor,
                                }}
                              >
                                <Icon icon={method.icon} size="sm" color={method.brandColor} />
                              </div>

                              <div className="min-w-0 w-full">
                                <div className="tds-stack-h tds-gap-1 items-center justify-between">
                                  <span className={`tds-small font-black leading-tight transition-colors ${
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
                                      <Icon icon="CheckCircle2" size="md" />
                                    </motion.span>
                                  )}
                                </div>
                                {isUnavailable && (
                                  <span className="tds-caption font-bold text-grey-400 block mt-0.5">
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
              <div className="tds-stack-h tds-gap-4 items-center justify-between tds-p-3 cust-bg-card rounded-xl border cust-border">
                {selectedMethodData && selectedGroup ? (
                  <div className="tds-stack-h tds-gap-2 items-center min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg tds-stack items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${selectedMethodData.brandColor}15`, color: selectedMethodData.brandColor }}
                    >
                      <Icon icon={selectedMethodData.icon} size="sm" color={selectedMethodData.brandColor} />
                    </div>
                    <div className="min-w-0">
                      <p className="tds-small font-black cust-text-main truncate">
                        {selectedGroup.label} · {selectedMethodData.label}
                      </p>
                      <p className="tds-caption text-grey-400 truncate">{selectedMethodData.desc}</p>
                    </div>
                  </div>
                ) : (
                  <span className="tds-small font-bold text-grey-400">{t('cart_modal.select_payment_guide')}</span>
                )}
                <span className="tds-text-bold text-base text-primary flex-shrink-0 ml-2">{formatWon(totalPrice)}</span>
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
                    return (<React.Fragment><tds-stack-h tds-gap-2 items-center><Icon icon={methodData.icon} size="md" color="inverse" /><span>{t('cart_modal.order_with_method', { method: methodData.label })}</span></tds-stack-h></React.Fragment>);
                  }
                  return (<React.Fragment><tds-stack-h tds-gap-2 items-center><Icon icon="CreditCard" size="md" /><span>{t('cart_modal.title')}</span></tds-stack-h></React.Fragment>);
                })()}
              </Button>
            </div>
          </motion.div>}
          <TogetherPaymentSheet
            isOpen={isSplitPaymentOpen && isOpen}
            onClose={() => setIsSplitPaymentOpen(false)}
            isSubmitting={isOrdering}
            cart={splitCart}
            totalAmount={totalPrice}
            onConfirm={async (splitData) => {
              if (!onSplitPayment) return;
              const result = await onSplitPayment(splitData);
              if (result?.success) setIsSplitPaymentOpen(false);
            }}
            theme={{ primaryColor: '#2563eb' }}
            formatPrice={formatWon}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default CartModal;


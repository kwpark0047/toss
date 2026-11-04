import Icon from '../ui/Icon';

/**
 * 장바구니의 주문 방식 선택 — 매장 식사 / 포장 / 배달.
 * 배달이면 주소·요청사항을 받고 서버 견적(권역·최소 주문 금액·배달비)을 보여 준다.
 */
const TYPE_META = {
  dine_in: { label: '매장에서 먹기', icon: 'Utensils' },
  takeout: { label: '포장', icon: 'ShoppingBag' },
  delivery: { label: '배달', icon: 'Truck' },
};

const won = (n) => `${Number(n || 0).toLocaleString()}원`;

export default function OrderTypePanel({
  types,
  orderType,
  onOrderTypeChange,
  pickupGuide,
  delivery,
  deliveryAddress,
  onDeliveryAddressChange,
  deliveryMemo,
  onDeliveryMemoChange,
  quote,
  quoting,
}) {
  if (!types?.length) return null;
  return (
    <div className="tds-p-3 cust-bg-card rounded-xl border cust-border tds-stack tds-gap-2" data-testid="order-type-panel">
      <span className="tds-small font-black cust-text-sub">주문 방식</span>
      {types.length > 1 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="주문 방식">
          {types.map((type) => {
            const meta = TYPE_META[type];
            const selected = orderType === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onOrderTypeChange(type)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 tds-small font-black transition ${selected ? 'border-primary bg-primary/10 text-primary' : 'cust-border cust-text-main'}`}
              >
                <Icon icon={meta.icon} size="md" /> {meta.label}
              </button>
            );
          })}
        </div>
      )}
      {types.length === 1 && (
        <p className="tds-small font-bold cust-text-main">{TYPE_META[types[0]].label} 주문</p>
      )}

      {orderType === 'takeout' && pickupGuide && (
        <p className="tds-caption text-grey-500">{pickupGuide}</p>
      )}

      {orderType === 'delivery' && (
        <div className="tds-stack tds-gap-2">
          {delivery && (
            <p className="tds-caption text-grey-500">
              {won(delivery.min_order_amount)} 이상 · 배달비 {won(delivery.fee)} · 약 {delivery.est_minutes}분
            </p>
          )}
          <label htmlFor="delivery-address" className="sr-only">배달 주소</label>
          <input
            id="delivery-address"
            type="text"
            autoComplete="street-address"
            maxLength={300}
            value={deliveryAddress}
            onChange={(e) => onDeliveryAddressChange(e.target.value)}
            placeholder="배달 받을 주소 (도로명 주소와 동·호수)"
            className="w-full bg-grey-50 dark:bg-white/5 border border-grey-200 dark:border-white/10 rounded-xl tds-p-3 tds-p-2.5 tds-small font-bold cust-text-main placeholder:text-grey-400 outline-none focus:border-primary"
          />
          <label htmlFor="delivery-memo" className="sr-only">배달 요청사항</label>
          <input
            id="delivery-memo"
            type="text"
            maxLength={500}
            value={deliveryMemo}
            onChange={(e) => onDeliveryMemoChange(e.target.value)}
            placeholder="요청사항 (예: 문 앞에 두고 벨 눌러 주세요)"
            className="w-full bg-grey-50 dark:bg-white/5 border border-grey-200 dark:border-white/10 rounded-xl tds-p-3 tds-p-2.5 tds-small cust-text-main placeholder:text-grey-400 outline-none focus:border-primary"
          />
          {quoting && <p className="tds-caption text-grey-400">배달 가능 여부를 확인하는 중…</p>}
          {!quoting && quote && (
            <p className={`tds-caption font-bold ${quote.deliverable ? 'text-emerald-600' : 'text-rose-600'}`} role="status">
              {quote.deliverable ? `배달 가능 · 배달비 ${won(quote.fee)}가 결제 금액에 더해집니다.` : quote.reason}
            </p>
          )}
          <p className="tds-caption text-grey-400">배달 주문은 온라인 결제로만 주문할 수 있고, 연락받을 전화번호가 필요합니다.</p>
        </div>
      )}
    </div>
  );
}

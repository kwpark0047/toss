import { Link } from 'react-router-dom';
import { MapPin, ArrowUpRight, Check } from 'lucide-react';
import './orderCompletion.css';


function optionsText(raw) {
  try {
    const options = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(options) ? options.map(o => typeof o === 'string' ? o : o.choiceName || o.name || o.value).filter(Boolean).join(' / ') : '';
  } catch { return typeof raw === 'string' ? raw : ''; }
}
const won = value => value != null && Number.isFinite(Number(value))
  ? `${Number(value).toLocaleString('ko-KR')}원` : '확인 중';
const methods = { card: '카드결제', CARD: '카드결제', toss: '토스페이', toss_pay: '토스페이', kakao: '카카오페이', naver: '네이버페이', cash: '현금', transfer: '계좌이체', store_card: '매장 카드 단말기', point: '포인트', mixed: '복합결제' };

export default function OrderCompletion({ order = {}, payment = {}, storeName, paid = false, pointsEarned = 0, onBeforeLeave, children }) {
  const items = order.items || order.order_items || [];
  const method = order.payment_method || payment.method;
  const amount = payment.totalAmount ?? payment.amount ?? order.total_amount;
  const renderItem = (item, index) => <li key={item.id || index}>
    <div><span>{item.product_name || item.name || item.menuItem?.name || '주문 메뉴'} × {item.quantity}</span>
      {optionsText(item.options || item.selectedOptions) && <small>{optionsText(item.options || item.selectedOptions)}</small>}</div>
    <strong>{won(item.subtotal ?? ((item.price ?? item.unitPrice) * item.quantity))}</strong>
  </li>;
  return <section className="order-completion" aria-label="주문 및 결제 확인">
    <header className="oc-header">
      <span className="oc-status"><Check size={14} aria-hidden="true" /> {paid ? '결제 완료' : '결제 확인 대기'}</span>
      <img className="oc-art" src="/images/order-thanks.svg" alt="정성껏 준비한 주문을 담은 쇼핑백과 감사 카드" width="160" height="108" />
      <h1>{paid ? '결제가 완료되었습니다!' : '주문이 접수되었습니다'}</h1>
      <p className="oc-thanks">주문해 주셔서 감사합니다.</p>
      <p>정성껏 준비해 드리겠습니다.</p>
    </header>
    <div className="oc-receipt">
      <div className="oc-store">{storeName || order.store_name || '주문 내역'}</div>
      <dl className="oc-meta">
        <div><dt>주문번호</dt><dd>{order.order_number || order.id || '주문내역에서 확인'}</dd></div>
        {order.queue_number && <div><dt>대기번호</dt><dd>{order.queue_number}</dd></div>}
        {Number(order.estimated_minutes) > 0 && <div><dt>예상 소요시간</dt><dd>약 {order.estimated_minutes}분</dd></div>}
        {order.order_type && <div><dt>이용방법</dt><dd>{{ dine_in: '매장 이용', takeout: '포장', delivery: '배달' }[order.order_type] || order.order_type}</dd></div>}
      </dl>
      {items.length ? <>
        <ul className="oc-items">{items.slice(0, 3).map(renderItem)}</ul>
        {items.length > 3 && <details className="oc-more"><summary>나머지 메뉴 {items.length - 3}개 보기</summary>
          <ul className="oc-items">{items.slice(3).map(renderItem)}</ul>
        </details>}
      </> : <p className="oc-note">상세 메뉴는 주문 진행 화면에서 확인할 수 있습니다.</p>}
      <dl className="oc-meta oc-totals">
        {Number(order.discount_amount) > 0 && <div><dt>할인</dt><dd>−{won(order.discount_amount)}</dd></div>}
        {Number(order.delivery_fee) > 0 && <div><dt>배달비</dt><dd>{won(order.delivery_fee)}</dd></div>}
        <div className="oc-amount"><dt>{paid ? '최종 결제금액' : '결제 예정금액'}</dt><dd>{won(amount)}</dd></div>
        {method && <div><dt>결제수단</dt><dd>{methods[method] || method}</dd></div>}
        {Number(pointsEarned || order.points_earned) > 0 && <div><dt>적립 포인트</dt><dd>+{Number(pointsEarned || order.points_earned).toLocaleString('ko-KR')} P</dd></div>}
      </dl>
      {!paid && <p className="oc-pending">{method === 'transfer' ? '입금 확인 대기 중입니다. 직원에게 입금 여부를 알려주세요.' : '직원의 결제 확인 후 결제 완료로 표시됩니다.'}</p>}
    </div>
    <nav className="oc-next" aria-label="다음 화면 선택">
      <h2>다음으로 어디로 이동할까요?</h2>
      <Link className="oc-primary" to="/search?afterOrder=1" onClick={onBeforeLeave}><MapPin size={19} aria-hidden="true" /><span>매장찾기 · 주문진행 확인</span><span aria-hidden="true">→</span></Link>
      <div className="oc-external">
        <a href="https://www.naver.com/" target="_blank" rel="noopener noreferrer" onClick={onBeforeLeave}>네이버 열기 <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
        <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" onClick={onBeforeLeave}>유튜브 열기 <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a>
      </div>
      <p className="oc-note">외부 서비스 이용 후 이 화면으로 돌아와 주문을 확인할 수 있어요.</p>
    </nav>
    {children}
  </section>;
}

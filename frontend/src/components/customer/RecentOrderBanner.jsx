import { useState } from 'react';
import OrderStatusModal from '../menu/OrderStatusModal';

export default function RecentOrderBanner() {
  const [open, setOpen] = useState(false);
  const [recent] = useState(() => {
    try {
      const order = JSON.parse(sessionStorage.getItem('wm_recent_order'));
      return order?.id && order?.store_id && Date.now() - order.savedAt < 86400000 ? order : null;
    } catch { return null; }
  });
  if (!recent) return null;
  return <>
    <aside className="mb-6 rounded-2xl border border-orange-400/40 bg-slate-900 p-4 text-slate-100" aria-label="방금 주문한 내역">
      <p className="text-sm font-bold break-words">{recent.store_name || '방금 주문한 매장'} · 주문 {recent.order_number || recent.id}</p>
      <p className="mt-1 text-xs text-slate-300">매장을 둘러보면서 내 주문 진행을 확인하세요.</p>
      <button className="mt-3 min-h-12 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400" onClick={() => setOpen(true)}>내 주문 진행 확인</button>
    </aside>
    <OrderStatusModal isOpen={open} onClose={() => setOpen(false)} orderId={recent.id} storeId={recent.store_id} capability={recent.capability} />
  </>;
}

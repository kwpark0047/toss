import { useEffect, useState } from 'react';
import { storeManagerAPI } from '../../api/storeManager';

export default function ManagerFeaturedMenus({ storeId, menuItems, storeOpen, onAddToCart }) {
  const [ids, setIds] = useState([]);
  useEffect(() => {
    if (!storeId || !menuItems.length) return undefined;
    let active = true;
    const load = () => {
      void storeManagerAPI
        .featured(storeId)
        .then((response) => {
          const rows = response?.data || response;
          if (active) setIds(Array.isArray(rows) ? rows.map((row) => row.id) : []);
        })
        .catch(() => {
          if (active) setIds([]);
        });
    };
    load();
    const interval = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [storeId, menuItems.length]);
  const items = menuItems.filter(
    (item) =>
      ids.includes(item.id) &&
      !item.is_sold_out &&
      item.is_active !== false &&
      (item.stock_quantity == null || item.stock_quantity > 0)
  );
  if (!items.length) return null;
  return (
    <section
      aria-label="매장 추천 메뉴"
      className="mx-4 my-4 rounded-2xl border border-orange-400/30 bg-orange-500/5 p-4"
    >
      <h2 className="font-bold mb-3">지금 추천하는 메뉴</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            disabled={!storeOpen}
            className="rounded-xl cust-bg-card border cust-border px-4 py-3 text-left disabled:opacity-50"
            onClick={() => onAddToCart(item)}
          >
            <span className="font-semibold block">{item.name}</span>
            <span className="text-sm">{Number(item.price).toLocaleString('ko-KR')}원 · 담기</span>
          </button>
        ))}
      </div>
    </section>
  );
}

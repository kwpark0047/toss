import { useState, useEffect } from 'react';
import { aiAPI } from '@/api';
import { Sparkles, Plus } from 'lucide-react';

/**
 * PersonalizedRecommendations (F9) — AI 개인화 메뉴 추천.
 *
 * 고객 주문 이력(localStorage의 전화번호 기반)을 참고해 Gemini가 오늘의 추천
 * 메뉴를 제안한다. 전화번호가 없으면 상황(시간/기본) 기반 일반 추천을 보여준다.
 * 실패/빈 결과 시 아무것도 렌더하지 않아 메뉴 흐름을 방해하지 않는다.
 */
export default function PersonalizedRecommendations({ storeId, storeOpen, onAddToCart, menuItems = [] }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let savedPhone = null;
      try { savedPhone = localStorage.getItem('wm_customer_phone'); } catch { /* 무시 */ }
      setPhone(savedPhone);
      try {
        const res = await aiAPI.recommend({
          store_id: Number(storeId),
          phone: savedPhone || undefined,
        });
        const data = res?.data || res;
        if (!cancelled) setRecs((data?.recommendations || []).slice(0, 3));
      } catch {
        if (!cancelled) setRecs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  // 로딩 중이거나 추천이 없으면 렌더하지 않음 (메뉴 흐름 방해 최소화)
  if (loading || recs.length === 0) return null;

  // 추천 항목을 실제 메뉴 데이터와 매칭(이미지/품절 등 최신 정보 반영)
  const resolve = (rec) => menuItems.find((m) => m.id === rec.id) || rec;

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-fuchsia-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-orange-400" />
          <h3 className="tds-body-strong text-white">
            {phone ? '고객님을 위한 오늘의 추천' : '오늘의 추천 메뉴'}
          </h3>
          <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">AI</span>
        </div>
        <div className="space-y-2">
          {recs.map((rec) => {
            const item = resolve(rec);
            const soldOut = item.is_sold_out;
            return (
              <div key={rec.id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" loading="lazy" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="tds-label text-white truncate">{item.name}</p>
                  <p className="tds-caption text-orange-200/80 truncate">{rec.recommend_reason || '추천 메뉴'}</p>
                </div>
                <span className="tds-label text-white shrink-0">{(item.price || 0).toLocaleString('ko-KR')}원</span>
                {onAddToCart && !soldOut && storeOpen && (
                  <button
                    onClick={() => onAddToCart(item)}
                    aria-label={`${item.name} 담기`}
                    className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

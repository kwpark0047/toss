import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Tag, Megaphone, Utensils, Flame } from 'lucide-react';
import { storesAPI } from '../api/stores';
import { hasCorruptName } from '../utils/storeName';

/** 배너 종류별 스타일/라벨 */
const META = {
  EVENT:     { label: '이벤트', icon: Sparkles,  grad: 'from-violet-500 to-fuchsia-600' },
  PROMOTION: { label: '할인',   icon: Tag,       grad: 'from-orange-500 to-rose-600' },
  NEWS:      { label: '소식',   icon: Megaphone, grad: 'from-sky-500 to-blue-600' },
  PRODUCT:   { label: '신메뉴', icon: Utensils,  grad: 'from-emerald-500 to-teal-600' },
  POPULAR:   { label: '인기',   icon: Flame,     grad: 'from-amber-500 to-orange-600' },
  MENU:      { label: '추천',   icon: Utensils,  grad: 'from-rose-500 to-pink-600' },
};

const ROTATE_MS = 4500;
const prefersReduced = () => typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * HighlightBanner — 매장 위치 상단 롤링 배너.
 * 지역 매장의 추천메뉴·이벤트를 자동 순환 표시. 클릭 시 해당 매장 메뉴로 이동.
 * props: district(선택)
 */
export default function HighlightBanner({ district = '' }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    storesAPI.highlights({ district: district || undefined })
      .then(res => {
        if (!alive) return;
        // 안전망: 매장명·타이틀이 손상(인코딩 깨짐)된 배너는 제외
        const list = ((res?.data || res)?.banners || []).filter(b => !hasCorruptName(b.store_name) && !hasCorruptName(b.title));
        setItems(list); setIdx(0);
      })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [district]);

  const go = useCallback((n) => {
    setIdx(i => (n + items.length) % items.length);
  }, [items.length]);

  // 자동 롤링 (모션 최소화 설정 시 정지)
  useEffect(() => {
    if (items.length <= 1 || prefersReduced()) return;
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  if (loading) return <div className="skeleton h-32 rounded-3xl mb-8" />;
  if (items.length === 0) return null;

  const cur = items[idx];
  const meta = META[cur.type] || META.MENU;
  const Icon = meta.icon;

  return (
    <div className="relative mb-8">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${meta.grad} shadow-lg`}>
        <AnimatePresence mode="wait">
          <motion.button
            key={idx}
            type="button"
            onClick={() => cur.store_id && navigate(`/menu/${cur.store_id}`)}
            aria-label={`${meta.label}: ${cur.title} — ${cur.store_name} 매장으로 이동`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full text-left flex items-center gap-4 sm:gap-6 p-5 sm:p-7 min-h-[128px]"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Icon size={28} className="text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <span className="inline-flex items-center gap-1 text-[11px] font-black bg-white/25 px-2 py-0.5 rounded-full mb-1.5">
                {meta.label}
              </span>
              <h3 className="text-lg sm:text-2xl font-black leading-tight text-balance line-clamp-1">{cur.title}</h3>
              <p className="text-sm text-white/85 mt-0.5 line-clamp-1">
                {cur.store_name && <span className="font-bold">{cur.store_name}</span>}
                {cur.subtitle && <span className="text-white/70"> · {cur.subtitle}</span>}
              </p>
            </div>
            <ChevronRight size={22} className="text-white/70 shrink-0 hidden sm:block" aria-hidden="true" />
          </motion.button>
        </AnimatePresence>

        {/* 좌우 컨트롤 */}
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => go(idx - 1)} aria-label="이전 배너"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/15 hover:bg-black/30 text-white flex items-center justify-center backdrop-blur transition-colors">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(idx + 1)} aria-label="다음 배너"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/15 hover:bg-black/30 text-white flex items-center justify-center backdrop-blur transition-colors">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* 인디케이터 */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="배너 선택">
          {items.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)}
              role="tab" aria-selected={i === idx} aria-label={`${i + 1}번째 배너`}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-gray-300 hover:bg-gray-400'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

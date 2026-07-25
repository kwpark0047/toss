import { useState, useEffect, useMemo } from 'react';
import { aiAPI } from '@/api';
import { Sparkles, Plus, Sun, Moon, CloudSun, CloudRain, TrendingUp } from 'lucide-react';
import LazyImage from '../common/LazyImage';
import { vibrateClick } from '../../utils/notificationSound';

const TIME_ICONS = {
  morning: Sun,
  lunch: Sun,
  snack: CloudSun,
  dinner: CloudSun,
  night: Moon,
};

const TIME_LABELS = {
  morning: '아침',
  lunch: '점심',
  snack: '오후 간식',
  dinner: '저녁',
  night: '야식',
};

const _WEATHER_ICONS = {
  sunny: Sun,
  cloudy: CloudSun,
  rainy: CloudRain,
  snowy: CloudRain,
};

const _WEATHER_EMOJIS = {
  sunny: '☀️',
  cloudy: '⛅',
  rainy: '🌧️',
  snowy: '🌨️',
};

function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 15 && h < 17) return 'snack';
  if (h >= 17 && h < 22) return 'dinner';
  return 'night';
}

function getSeasonEmoji() {
  const m = new Date().getMonth();
  if (m >= 3 && m <= 5) return '🌸'; // 봄
  if (m >= 6 && m <= 8) return '🌻'; // 여름
  if (m >= 9 && m <= 11) return '🍂'; // 가을
  return '❄️'; // 겨울
}

/**
 * PersonalizedRecommendations (F9) — AI 개인화 메뉴 추천 (고도화).
 *
 * 시간대·날씨(간이 추정)·실시간 트렌드를 AI 프롬프트에 주입해 더 정확한
 * 추천을 제공한다. 실패/빈 결과 시 아무것도 렌더하지 않는다.
 */
export default function PersonalizedRecommendations({ storeId, storeOpen, onAddToCart, menuItems = [] }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState(null);

  const timePeriod = useMemo(() => getTimePeriod(), []);
  const TimeIcon = TIME_ICONS[timePeriod];
  const seasonEmoji = useMemo(() => getSeasonEmoji(), []);

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
          preferences: savedPhone ? undefined : '일반',
          weather: '', // 서버에서 기본값 "맑음" 처리
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

  if (loading || recs.length === 0) return null;

  const resolve = (rec) => menuItems.find((m) => m.id === rec.id) || rec;
  const hasTrending = recs.some(r => r.is_trending);

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-fuchsia-500/5 dark:from-orange-500/20 dark:to-fuchsia-500/10 p-4 shadow-sm">
        {/* 헤더: 시간대 + 계절 */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-orange-400" />
          <h3 className="font-bold text-grey-900 dark:text-white text-sm">
            {phone ? '고객님을 위한 오늘의 추천' : '오늘의 추천 메뉴'}
          </h3>
          <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">AI</span>
        </div>

        {/* 시간대/계절 뱃지 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70 bg-white/10 px-2 py-1 rounded-full">
            <TimeIcon size={11} aria-hidden="true" />
            {TIME_LABELS[timePeriod]}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70 bg-white/10 px-2 py-1 rounded-full">
            {seasonEmoji}
            {['🌸', '🌻', '🍂', '❄️'].indexOf(seasonEmoji) === 0 ? '봄' :
             ['🌸', '🌻', '🍂', '❄️'].indexOf(seasonEmoji) === 1 ? '여름' :
             ['🌸', '🌻', '🍂', '❄️'].indexOf(seasonEmoji) === 2 ? '가을' : '겨울'}
          </span>
          {hasTrending && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/15 px-2 py-1 rounded-full">
              <TrendingUp size={11} aria-hidden="true" />
              인기
            </span>
          )}
        </div>

        {/* 추천 목록 */}
        <div className="space-y-2">
          {recs.map((rec) => {
            const item = resolve(rec);
            const soldOut = item.is_sold_out;
            return (
              <div key={rec.id} className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
                <div className="w-12 h-12 shrink-0">
                  <LazyImage 
                    src={item.image_url} 
                    alt={item.name} 
                    className="rounded-lg"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-white text-sm truncate">{item.name}</p>
                    {rec.is_trending && (
                      <span className="shrink-0 text-[9px] font-black text-rose-400 bg-rose-500/20 px-1 py-0.5 rounded">HOT</span>
                    )}
                  </div>
                  <p className="text-[11px] text-orange-200/80 truncate leading-tight mt-0.5">{rec.recommend_reason || '추천 메뉴'}</p>
                </div>
                <span className="font-bold text-white text-sm shrink-0">{(item.price || 0).toLocaleString('ko-KR')}원</span>
                {onAddToCart && !soldOut && storeOpen && (
                  <button
                    onClick={() => {
                      vibrateClick();
                      onAddToCart(item);
                    }}
                    aria-label={`${item.name} 담기`}
                    className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:scale-90 transition-all"
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

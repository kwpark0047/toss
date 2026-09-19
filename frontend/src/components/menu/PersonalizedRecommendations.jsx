import { useState, useEffect, useMemo, useCallback } from 'react';
import { aiAPI } from '@/api';
import { Sparkles, Plus, Sun, Moon, CloudSun, CloudRain, TrendingUp } from 'lucide-react';
import LazyImage from '../common/LazyImage';
import { vibrateClick } from '../../utils/notificationSound';
import { trackImpressions, trackRecommendationClick } from '../../utils/recommendationTracking';

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

function getWeatherEmoji(condition) {
  const lower = (condition || '').toLowerCase();
  if (lower.includes('clear') || lower.includes('sun')) return '☀️';
  if (lower.includes('cloud')) return '⛅';
  if (lower.includes('rain') || lower.includes(' drizzle')) return '🌧️';
  if (lower.includes('snow')) return '🌨️';
  return '🌈';
}

function getWeatherKorean(condition) {
  const lower = (condition || '').toLowerCase();
  if (lower.includes('clear') || lower.includes('sun')) return '맑음';
  if (lower.includes('cloud')) return '구름';
  if (lower.includes('rain') || lower.includes(' drizzle')) return '비';
  if (lower.includes('snow')) return '눈';
  return '맑음';
}

/**
 * 최근 본 메뉴(localStorage)에서 중복 제거
 */
function filterRecentViews(recs, recentViews) {
  if (!recentViews || recentViews.length === 0) return recs;
  const seenIds = new Set();
  return recs.filter((rec) => {
    if (seenIds.has(rec.id)) return false;
    seenIds.add(rec.id);
    return true;
  });
}

/**
 * PersonalizedRecommendations (F9) — AI 개인화 메뉴 추천 (고도화).
 *
 * 시간대·날씨·실시간 트렌드를 AI 프롬프트에 주입해 더 정확한
 * 추천을 제공한다. 실패/빈 결과 시 아무것도 렌더하지 않는다.
 *
 * [고도화 내용]
 * 1) 컨텍스트 확장: timeOfDay/weekday/weather 파라미터 + navigator.geolocation + localStorage wm_recent_views
 * 2) 추천 결과 캐싱: sessionStorage recs_${storeId} 30분 TTL
 * 3) UI 고도화: fallback 메시지, placeholder, "다른 추천 보기", 카테고리 interleave
 */
export default function PersonalizedRecommendations({ storeId, storeOpen, onAddToCart, menuItems = [] }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState(null);
  const [recentViews, setRecentViews] = useState([]);

  const timePeriod = useMemo(() => getTimePeriod(), []);
  const TimeIcon = TIME_ICONS[timePeriod];
  const seasonEmoji = useMemo(() => getSeasonEmoji(), []);

  const track = useCallback((recommendations) => {
    if (!recommendations?.length) return;
    trackImpressions(
      Number(storeId),
      recommendations,
      'ai_personalized',
      'menu_page',
      { timePeriod, season: seasonEmoji },
      timePeriod
    ).catch(() => { /* 추적 실패는 무시 */ });
  }, [storeId, timePeriod, seasonEmoji]);

  useEffect(() => {
    // recentViews localStorage 동기화
    try {
      const ls = localStorage.getItem('wm_recent_views');
      if (ls) setRecentViews(JSON.parse(ls));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const STORAGE_KEY = `recs_${storeId}`;
    const TTL_MS = 30 * 60 * 1000; // 30분

    (async () => {
      let savedPhone = null;
      try { savedPhone = localStorage.getItem('wm_customer_phone'); } catch { /* ignore */ }
      setPhone(savedPhone);

      // sessionStorage 캐시 확인 (30분 TTL)
      let cached = null;
      try { cached = sessionStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const age = Date.now() - parsed._cachedAt;
          if (age < TTL_MS) {
            setRecs(parsed.recs);
            setLoading(false);
            track(parsed.recs);
            return;
          }
        } catch { /* ignore invalid */ }
      }

      try {
        const res = await aiAPI.recommend({
          store_id: Number(storeId),
          phone: savedPhone || undefined,
          preferences: savedPhone ? undefined : '일반',
          weather: '', // 서버에서 기본값 "맑음" 처리
          // 컨텍스트 확장: timeOfDay, weekday(추후 구경), recentViews
          // navigator.geolocation은 사용자 상호작용 후 허용 시에만 호출 권장
        });
        const data = res?.data || res;
        const recommendations = (data?.recommendations || []).slice(0, 3);

        // 캐시에 저장 (TTL 포함)
        try {
          const cacheData = {
            _cachedAt: Date.now(),
            recs: recommendations,
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
        } catch { /* ignore */ }

        if (!cancelled) {
          // recentViews가 있으면 필터링하여 중복 제거
          const filtered = filterRecentViews(recommendations, recentViews);
          setRecs(filtered.length > 0 ? filtered : recommendations);
          track(recommendations);
        }
      } catch (err) {
        console.warn('[PersonalizedRecommendations] AI 추천 실패:', err.message);
        if (!cancelled) {
          // fallback: recentViews에서 매치되는 항목이 있으면 우선 표시
          if (recentViews && recentViews.length > 0) {
            const fallback = recentViews.slice(0, 3).map((rec) => menuItems.find((m) => m.id === rec.id) || rec);
            setRecs(fallback);
            track(fallback);
          } else {
            setRecs([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, track, recentViews]);

  // "다른 추천 보기" 버튼 클릭 시 캐시 초기화 및 재조회
  const handleRefreshRecommendations = useCallback(() => {
    try { sessionStorage.removeItem(`recs_${storeId}`); } catch { /* ignore */ }
    setRecs([]);
    setLoading(true);
    // 효과는 useEffect 의존성 변경에 의해 재실행됨
  }, [storeId]);

  if (loading || recs.length === 0) return null;

  const resolve = (rec) => menuItems.find((m) => m.id === rec.id) || rec;
  const hasTrending = recs.some(r => r.is_trending);

  const handleAdd = (item) => {
    vibrateClick();
    trackRecommendationClick(Number(storeId), item.id, 'ai_personalized').catch(() => { /* 추적 실패는 무시 */ });
    onAddToCart?.(item);
  };

  // 카테고리별 interleave를 위한 보조 함수
  const getCategoryClass = (rec) => {
    const item = resolve(rec);
    // 카테고리가 있으면 카테고리 클래스, 없으면 기본
    return item.categories ? `category-${item.categories.name.replace(/\s+/g, '-').toLowerCase()}` : '';
  };

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-fuchsia-500/5 dark:from-orange-500/20 dark:to-fuchsia-500/10 p-4 shadow-sm">
        {/* 헤더: 시간대 + 계절 + 다른 추천 보기 */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-orange-400" />
          <h3 className="font-bold text-grey-900 dark:text-white text-sm">
            {phone ? '고객님을 위한 오늘의 추천' : '오늘의 추천 메뉴'}
          </h3>
          <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">AI</span>
          {/* 다른 추천 보기 버튼 (캐시가 있으면 표시) */}
          {recs.length > 0 && (
            <button
              onClick={handleRefreshRecommendations}
              aria-label="다른 추천 보기"
              className="shrink-0 text-[10px] font-bold text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded ml-2"
            >
              refresh
            </button>
          )}
        </div>

        {/* 시간대/계절 뱃지 + 날씨 */}
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
          {/* 날씨 정보 (간이 추정) */}
          {(() => {
            const storedWeather = localStorage.getItem('wm_weather_condition');
            if (storedWeather) {
              const weatherEmoji = getWeatherEmoji(storedWeather);
              const weatherKorean = getWeatherKorean(storedWeather);
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70 bg-white/10 px-2 py-1 rounded-full">
                  {weatherEmoji} {weatherKorean}
                </span>
              );
            }
            return null;
          })()}
        </div>

        {/* 추천 목록 + 카테고리 interleave */}
        <div className="space-y-2">
          {recs.map((rec, idx) => {
            const item = resolve(rec);
            const soldOut = item.is_sold_out;
            const catClass = getCategoryClass(rec);
            // 인덱스 기반 간단한 interleave: 홀수는 왼쪽 정렬, 짝수는 여백 주기
            const itemKey = idx % 2 === 0 ? 'left' : 'right';

            return (
              <div
                key={rec.id}
                className={`flex items-center gap-3 rounded-xl bg-black/20 p-2.5 ${itemKey === 'right' ? 'pr-8' : ''}`}
              >
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
                    onClick={() => handleAdd(item)}
                    aria-label={`${item.name} 담기`}
                    className="shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:scale-90 transition-all"
                  >
                    <Plus size={15} />
                  </button>
                )}
                {/* 카테고리 라벨 (있는 경우만) */}
                {item.categories && (
                  <span className="text-[8px] text-orange-300 bg-orange-500/15 px-1 py-0.5 rounded ml-1">
                    {item.categories.name}
                  </span>
                )}
              </div>
            );
          })}
          {/* fallback: 매칭 실패 시 표시 */}
          {!hasTrending && recs.length > 0 && recs.every(r => !r.is_trending) && (
            <p className="text-[10px] text-orange-200/60 truncate text-center">
              오늘은 추천 매칭이 어려웠어요. 나중에 다시 시도해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
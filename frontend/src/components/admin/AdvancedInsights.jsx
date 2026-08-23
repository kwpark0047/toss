import { useState, useEffect, useMemo } from 'react';
import { analyticsAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import { Flame, Repeat, PieChart, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import Icon from '../ui/Icon';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500'];

/**
 * AdvancedInsights (F3) — 요일×시간 매출 히트맵 · 재구매율 · 카테고리별 매출 · 실시간 추세 차트.
 * @param {number|string} storeId
 * @param {number} dateRange 최근 N일 (AnalyticsDashboard와 동일 기준)
 */
export default function AdvancedInsights({ storeId, dateRange = 30 }) {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().slice(0, 10);
        const [insightsRes, forecastRes] = await Promise.allSettled([
          analyticsAPI.getInsights(storeId, start, end, { signal: controller.signal }),
          analyticsAPI.getForecast(storeId, Math.min(parseInt(dateRange), 7), { signal: controller.signal }),
        ]);
        if (insightsRes.status === 'fulfilled') setData(insightsRes.value?.data || insightsRes.value);
        if (forecastRes.status === 'fulfilled') setForecast(forecastRes.value?.data || forecastRes.value);
      } catch (e) {
        if (e.name !== 'CanceledError' && e.name !== 'AbortError') setData(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [storeId, dateRange]);

  // 히트맵 조회를 위한 맵 + 최대값
  const { cellMap, maxAmount } = useMemo(() => {
    const m = {};
    let max = 0;
    (data?.heatmap || []).forEach((c) => {
      m[`${c.day}-${c.hour}`] = c;
      if (c.amount > max) max = c.amount;
    });
    return { cellMap: m, maxAmount: max || 1 };
  }, [data]);

  const totalCatSales = useMemo(
    () => (data?.categories || []).reduce((s, c) => s + c.sales, 0) || 1,
    [data]
  );

  // 히트맵은 영업 시간대(9~24시)만 표시해 가독성 확보
  const hours = Array.from({ length: 15 }, (_, i) => i + 9);

  const heatColor = (amount) => {
    if (!amount) return 'bg-white/5';
    const t = amount / maxAmount;
    if (t > 0.75) return 'bg-orange-500';
    if (t > 0.5) return 'bg-orange-500/70';
    if (t > 0.25) return 'bg-orange-500/40';
    return 'bg-orange-500/20';
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/8 rounded-2xl p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-black text-white flex items-center gap-2">
        <Icon icon="Flame" /> 고급 인사이트
        <span className="text-xs font-medium text-slate-500">최근 {dateRange}일 · KST 기준</span>
      </h2>

      {/* 재구매율 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Repeat size={13} /> 재구매율</p>
          <p className="text-2xl font-black text-white">{data?.repeat?.rate ?? 0}<span className="text-sm text-slate-400">%</span></p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-slate-400 mb-1">전체 고객</p>
          <p className="text-2xl font-black text-white">{data?.repeat?.total_customers ?? 0}<span className="text-sm text-slate-400">명</span></p>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-slate-400 mb-1">재방문 고객</p>
          <p className="text-2xl font-black text-white">{data?.repeat?.repeat_customers ?? 0}<span className="text-sm text-slate-400">명</span></p>
        </div>
      </div>

      {/* 실시간 매출 추세 차트 (SVG 라인 차트) */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-sm font-black text-white mb-3 flex items-center gap-1.5"><TrendingUp size={15} className="text-orange-400" /> 매출 추세 (최근 {dateRange}일)</p>
        {(!data?.trend || data.trend.length === 0) ? (
          <p className="text-sm text-slate-500 py-4">추세 데이터가 없습니다.</p>
        ) : (
          <DailyTrendChart trend={data.trend} />
        )}
      </div>

      {/* AI 매출 예측 (7일) */}
      {forecast && forecast.predictions && forecast.predictions.length > 0 && (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <p className="text-sm font-black text-white mb-3 flex items-center gap-1.5"><Icon icon="BarChart3" /> AI 매출 예측 (7일)</p>
          <ForecastChart predictions={forecast.predictions} />
          {forecast.accuracy && (
            <p className="text-[10px] text-slate-500 mt-2">예측 정확도: {Math.round(forecast.accuracy * 100)}%</p>
          )}
        </div>
      )}

      {/* 요일×시간 히트맵 */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4 overflow-x-auto">
        <p className="text-sm font-black text-white mb-3 flex items-center gap-1.5"><Icon icon="Flame" /> 시간대별 매출 히트맵</p>
        <div className="min-w-[560px]">
          {/* 시간 헤더 */}
          <div className="flex gap-0.5 mb-0.5 pl-7">
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-slate-500">{h}</div>
            ))}
          </div>
          {DAY_LABELS.map((label, d) => (
            <div key={d} className="flex gap-0.5 mb-0.5 items-center">
              <div className="w-6 text-[10px] font-bold text-slate-400 text-center shrink-0">{label}</div>
              {hours.map((h) => {
                const cell = cellMap[`${d}-${h}`];
                return (
                  <div
                    key={h}
                    className={`flex-1 aspect-square rounded-sm ${heatColor(cell?.amount)}`}
                    title={cell ? `${label} ${h}시 · ${formatPrice(cell.amount, true)} · ${cell.count}건` : `${label} ${h}시 · 주문 없음`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">칸에 마우스를 올리면 상세 매출·주문수가 표시됩니다. 진할수록 매출이 높습니다.</p>
      </div>

      {/* 카테고리별 매출 */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-sm font-black text-white mb-3 flex items-center gap-1.5"><PieChart size={15} className="text-violet-400" /> 카테고리별 매출</p>
        {(!data?.categories || data.categories.length === 0) ? (
          <p className="text-sm text-slate-500 py-2">해당 기간 판매 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-2.5">
            {data.categories.map((c, i) => {
              const pct = Math.round((c.sales / totalCatSales) * 100);
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-bold">{c.category}</span>
                    <span className="text-slate-400">{formatPrice(c.sales, true)} · {c.quantity}개 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${CAT_COLORS[i % CAT_COLORS.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DailyTrendChart({ trend }) {
  const maxSales = Math.max(...trend.map(t => t.sales), 1);
  const chartHeight = 120;
  const chartWidth = Math.max(trend.length * 32, 280);
  const padding = 20;

  const points = trend.map((t, i) => {
    const x = padding + (i * (chartWidth - padding * 2)) / Math.max(trend.length - 1, 1);
    const y = chartHeight - (t.sales / maxSales) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight + padding} className="w-full h-auto">
        {[0, 25, 50, 75, 100].forEach((pct) => {
          const y = chartHeight - (pct / 100) * chartHeight;
          return (
            <line key={pct} x1={padding} y1={y} x2={chartWidth - padding} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          );
        })}
        <polyline points={points} fill="none" stroke="#f97316" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"         />
        {trend.map((t, i) => {
          const x = padding + (i * (chartWidth - padding * 2)) / Math.max(trend.length - 1, 1);
          const y = chartHeight - (t.sales / maxSales) * chartHeight;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#f97316" />
              <title>{t.date} · {formatPrice(t.sales, true)} · {t.orders}건</title>
            </g>
          );
        })}
        {trend.map((t, i) => {
          if (i % Math.ceil(trend.length / 6) !== 0 && i !== trend.length - 1) return null;
          const x = padding + (i * (chartWidth - padding * 2)) / Math.max(trend.length - 1, 1);
          return (
            <text key={i} x={x} y={chartHeight + 12} textAnchor="middle"
              className="text-[8px] fill-slate-500">{t.date.slice(5)}</text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * ForecastChart — AI 예측 매출 바 차트
 * @param {Array<{date: string, predicted: number}>} predictions
 */
function ForecastChart({ predictions }) {
  const maxPred = Math.max(...predictions.map(p => p.predicted), 1);

  return (
    <div className="flex items-end justify-between gap-1 h-24">
      {predictions.map((p, i) => {
        const height = (p.predicted / maxPred) * 80;
        return (
          <div key={i} className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-6 bg-gradient-to-t from-violet-500/30 to-violet-500 rounded-t-sm"
                style={{ height: `${height}px`, minHeight: '2px' }}>
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {formatPrice(p.predicted, true)}
                </div>
              </div>
            </div>
            <span className="text-[7px] text-slate-500 mt-1">{p.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

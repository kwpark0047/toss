import { useState, useEffect, useMemo } from 'react';
import { analyticsAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import { Flame, Repeat, PieChart, Loader2 } from 'lucide-react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500'];

/**
 * AdvancedInsights (F3) — 요일×시간 매출 히트맵 · 재구매율 · 카테고리별 매출.
 * @param {number|string} storeId
 * @param {number} dateRange 최근 N일 (AnalyticsDashboard와 동일 기준)
 */
export default function AdvancedInsights({ storeId, dateRange = 30 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().slice(0, 10);
        const res = await analyticsAPI.getInsights(storeId, start, end, { signal: controller.signal });
        setData(res?.data || res);
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
        <Flame size={18} className="text-orange-400" /> 고급 인사이트
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

      {/* 요일×시간 히트맵 */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4 overflow-x-auto">
        <p className="text-sm font-black text-white mb-3 flex items-center gap-1.5"><Flame size={15} className="text-orange-400" /> 시간대별 매출 히트맵</p>
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

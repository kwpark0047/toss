import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, Sparkles, MousePointerClick, ShoppingBag, CircleDollarSign, TrendingUp, Clock,
  BarChart3, RefreshCw, AlertCircle,
} from 'lucide-react';
import { recommendationAPI } from '@/api';

const TYPE_LABELS = {
  ai_personalized: 'AI 개인화 추천',
  tinkerbell: '팅커벨(매장 AI)',
  pairing: '메뉴 페어링',
  dessert: '디저트 추천',
  trending: '인기 메뉴',
};

function dateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function Card({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent || 'bg-orange-100 text-orange-600'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function RecommendationStatsPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [rangeDays, setRangeDays] = useState(7);
  const range = dateRange(rangeDays);

  const queryParams = { startDate: range.start, endDate: range.end };

  const summaryQuery = useQuery({
    queryKey: ['rec-summary', storeId, range],
    queryFn: () => recommendationAPI.getSummaryStats(storeId, queryParams),
    staleTime: 60 * 1000,
  });

  const dailyQuery = useQuery({
    queryKey: ['rec-daily', storeId, range],
    queryFn: () => recommendationAPI.getDailyStats(storeId, queryParams),
    staleTime: 60 * 1000,
  });

  const menuQuery = useQuery({
    queryKey: ['rec-menu', storeId, range],
    queryFn: () => recommendationAPI.getMenuPerformance(storeId, queryParams),
    staleTime: 60 * 1000,
  });

  const timeQuery = useQuery({
    queryKey: ['rec-time', storeId, range],
    queryFn: () => recommendationAPI.getTimePeriodPerformance(storeId, queryParams),
    staleTime: 60 * 1000,
  });

  const summary = summaryQuery.data?.data || summaryQuery.data || [];
  const daily = dailyQuery.data?.data || dailyQuery.data || [];
  const menus = menuQuery.data?.data || menuQuery.data || [];
  const timePeriods = timeQuery.data?.data || timeQuery.data || [];

  const totals = summary.reduce((acc, s) => ({
    impressions: acc.impressions + (s.impressions || 0),
    clicks: acc.clicks + (s.clicks || 0),
    conversions: acc.conversions + (s.conversions || 0),
    revenue: acc.revenue + (s.revenue || 0),
  }), { impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const cvr = totals.clicks > 0 ? totals.conversions / totals.clicks : 0;

  const loading = summaryQuery.isLoading || dailyQuery.isLoading || menuQuery.isLoading || timeQuery.isLoading;

  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600">
            <ChevronLeft className="w-6 h-6" />
            <span className="font-medium">AI 추천 성과 분석</span>
          </button>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  rangeDays === days ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {days}일
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : totals.impressions === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-700">추천 성과 데이터가 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">고객이 AI 추천을 확인하고 주문하면 이곳에 성과가 집계됩니다.</p>
          </div>
        ) : (
          <>
            {/* 핵심 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card icon={Sparkles} label="추천 노출" value={totals.impressions.toLocaleString()} accent="bg-amber-100 text-amber-600" />
              <Card icon={MousePointerClick} label="추천 클릭" value={totals.clicks.toLocaleString()} sub={`CTR ${pct(ctr)}`} accent="bg-blue-100 text-blue-600" />
              <Card icon={ShoppingBag} label="전환(주문)" value={totals.conversions.toLocaleString()} sub={`CVR ${pct(cvr)}`} accent="bg-emerald-100 text-emerald-600" />
              <Card icon={CircleDollarSign} label="추천 매출" value={`${totals.revenue.toLocaleString()}원`} accent="bg-fuchsia-100 text-fuchsia-600" />
            </div>

            {/* 추천 유형별 비교 */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                추천 유형별 성과
              </h3>
              <div className="space-y-3">
                {summary.map((s) => {
                  const sCtr = s.impressions > 0 ? s.clicks / s.impressions : 0;
                  const sCvr = s.clicks > 0 ? s.conversions / s.clicks : 0;
                  const maxImp = Math.max(...summary.map(x => x.impressions), 1);
                  return (
                    <div key={s.recommendation_type} className="rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-700">{TYPE_LABELS[s.recommendation_type] || s.recommendation_type}</span>
                        <span className="text-xs text-gray-500">
                          노출 {s.impressions.toLocaleString()} · 클릭 {s.clicks.toLocaleString()} · 전환 {s.conversions.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-400 to-rose-500" style={{ width: `${(s.impressions / maxImp) * 100}%` }} />
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>CTR {pct(sCtr)}</span>
                        <span>CVR {pct(sCvr)}</span>
                        <span>매출 {s.revenue.toLocaleString()}원</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 시간대별 성과 */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-500" />
                시간대별 추천 성과
              </h3>
              {timePeriods.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">시간대별 데이터가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {timePeriods.map((tp) => (
                    <div key={tp.time_period} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-sm font-bold text-gray-800">{tp.time_period}</p>
                      <p className="text-xs text-gray-500 mt-1">노출 {tp.impressions.toLocaleString()} · CTR {pct(tp.ctr)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">전환 {tp.conversions.toLocaleString()} · CVR {pct(tp.cvr)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 메뉴별 추천 성과 */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                추천 전환 메뉴 TOP
              </h3>
              {menus.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">메뉴별 전환 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {menus.slice(0, 10).map((m, idx) => (
                    <div key={m.menu_id || idx} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 text-sm truncate">{m.menu?.name || `메뉴 #${m.menu_id}`}</p>
                        <p className="text-xs text-gray-500">
                          전환 {m.conversions.toLocaleString()}회 · {m.quantity.toLocaleString()}개 · {m.revenue.toLocaleString()}원
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 shrink-0">{m.revenue.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 일별 추세 */}
            {daily.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  일별 추천 노출 추세
                </h3>
                <div className="flex items-end gap-1 h-32">
                  {daily.map((d, idx) => {
                    const max = Math.max(...daily.map(x => x.impressions), 1);
                    return (
                      <div key={d.id || idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-gradient-to-t from-indigo-400 to-violet-400" style={{ height: `${Math.max(4, (d.impressions / max) * 120)}px` }} />
                        <span className="text-[9px] text-gray-400">{String(new Date(d.date).getDate()).padStart(2, '0')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
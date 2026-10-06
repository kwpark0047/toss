import { useState, useEffect } from 'react';
import { analyticsAPI, ordersAPI } from '../../../api';
import { formatPrice } from '../../../utils/format';
import Icon from '../../ui/Icon';
import { normalizeSalesSeries } from '@/lib/dashboardData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';

const formatCompactPrice = (price) => {
  if (price >= 10000000) return (price / 10000000).toFixed(1) + '천만';
  if (price >= 10000) return (price / 10000).toFixed(0) + '만원';
  return formatPrice(price);
};

/* ─── 매출 추이 차트 ─── */
export const SalesTrendChart = ({ storeId }) => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    setLoading(true);
    setError(false);
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    analyticsAPI
      .getSales(storeId, 'daily', start, end)
      .then((res) => {
        if (active) setData(normalizeSalesSeries(res));
      })
      .catch(() => { if (active) { setData([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, days, retry]);

  if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
  if (!data || data.length === 0) return <section className="rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-semibold text-white">매출 추이</h3><p className="py-6 text-center text-sm text-slate-400">{error ? '매출 추이를 불러오지 못했습니다.' : `최근 ${days}일의 매출 데이터가 없습니다.`}</p>{error && <button onClick={() => setRetry(value => value + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-orange-500">다시 시도</button>}</section>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-black text-white flex items-center gap-1.5">
          <Icon icon="TrendingUp" size="md" className="text-orange-400" /> 매출 추이
        </h3>
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
          {[
            [7, '7일'],
            [30, '30일'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setDays(v)}
              className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all ${days === v ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => typeof v === 'string' && v.length > 5 ? v.slice(5) : v}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(v) => formatCompactPrice(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 11,
                color: '#e2e8f0',
              }}
              formatter={(v) => [formatPrice(v), '매출']}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="sales"
              stroke="#f97316"
              fill="url(#salesGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#f97316' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ─── 주문 상태 분포 ─── */
export const OrderStatusDonut = ({ stats }) => {
  const labels = { completed: '완료', pending: '대기', preparing: '조리 중', ready: '준비 완료', cancelled: '취소', confirmed: '확인', paid: '신규' };
  const entries = Object.entries(stats?.by_status || {}).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return <section aria-label="주문 상태 분포">
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Icon icon="ShoppingBag" size="sm" className="text-orange-400" />주문 상태</h3>
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {entries.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">선택한 기간의 주문이 없습니다.</p> : entries.map(([key, value]) => <div key={key}>
        <div className="mb-1 flex justify-between gap-3 text-xs"><span className="text-slate-300">{labels[key] || key}</span><span className="font-mono tabular-nums text-slate-300">{value}건 · {Math.round(value / total * 100)}%</span></div>
        <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500/70" style={{ width: `${value / total * 100}%` }} /></div>
      </div>)}
    </div>
  </section>;
};
/* ─── 피크타임 바 차트 ─── */
export const PeakHoursBar = ({ storeId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    ordersAPI
      .getDetailedStats(storeId, start, end)
      .then((res) => {
        const raw = res?.data ?? res;
        const hourly = raw?.hourly_breakdown ?? raw?.hourly ?? [];
        setData(Array.isArray(hourly) ? hourly : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [storeId]);

  if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count || 0), 1);

  return (
    <div>
      <h3 className="text-xs font-black text-white flex items-center gap-1.5 mb-2 px-1">
        <Icon icon="Clock" size="md" className="text-violet-400" /> 피크타임 (최근 7일)
      </h3>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}시`}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 11,
                color: '#e2e8f0',
              }}
              formatter={(v) => [v + '건', '주문']}
            />
            <Bar isAnimationActive={false} dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={(entry.count || 0) > maxCount * 0.7 ? '#a78bfa' : '#6366f1'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ─── AI 매출 예측 ─── */
export const SalesForecastWidget = ({ storeId, refreshKey = 0 }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    analyticsAPI
      .getForecast(storeId, 7)
      .then((res) => {
        const forecast = res?.data ?? res;
        const predictions = forecast?.predictions ?? forecast?.forecast ?? [];
        setData(Array.isArray(predictions) ? predictions : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [storeId, refreshKey]);

  if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
  if (!data || data.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-black text-white flex items-center gap-1.5 mb-2 px-1">
        <Icon icon="Sparkles" size="md" className="text-indigo-400" /> AI 매출 예측
      </h3>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v?.slice(5) ?? v}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(v) => formatCompactPrice(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 11,
                color: '#e2e8f0',
              }}
              formatter={(v, name) => {
                const labels = {
                  predicted: '예측 매출',
                  confidence_upper: '상한',
                  confidence_lower: '하한',
                };
                return [formatPrice(v), labels[name] || name];
              }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="confidence_upper"
              stroke="none"
              fill="url(#forecastGrad)"
            />
            <Area isAnimationActive={false} type="monotone" dataKey="confidence_lower" stroke="none" fill="#0F172A" />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="predicted"
              stroke="#818cf8"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 3"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[9px] text-slate-600 text-center mt-1 font-bold">
          점선: AI 예측 · 음영: 신뢰 구간
        </p>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { analyticsAPI, ordersAPI } from '../../../api';
import { formatPrice } from '../../../utils/format';
import Icon from '../../ui/Icon';
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
  PieChart as RechartsPieChart,
  Pie,
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

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    analyticsAPI
      .getSales(storeId, 'daily', start, end)
      .then((res) => {
        const items = res?.data ?? res ?? [];
        setData(Array.isArray(items) ? items : []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [storeId, days]);

  if (loading) return <div className="h-[200px] bg-white/5 rounded-2xl animate-pulse" />;
  if (!data || data.length === 0) return null;

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
              formatter={(v) => [formatPrice(v), '매출']}
            />
            <Area
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
  const byStatus = stats?.by_status;
  if (!byStatus) return null;

  const colorMap = {
    completed: '#10b981',
    pending: '#f97316',
    preparing: '#f59e0b',
    ready: '#34d399',
    cancelled: '#f43f5e',
    confirmed: '#3b82f6',
    paid: '#14b8a6',
  };
  const labelMap = {
    completed: '완료',
    pending: '대기',
    preparing: '조리중',
    ready: '준비완료',
    cancelled: '취소',
    confirmed: '확인',
    paid: '신규',
  };

  const data = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: labelMap[k] || k, value: v, color: colorMap[k] || '#64748b' }));

  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-black text-white flex items-center gap-1.5 mb-2 px-1">
        <Icon icon="ShoppingBag" size="md" className="text-emerald-400" /> 주문 상태
      </h3>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
        <ResponsiveContainer width="100%" height={140}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={58}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 11,
                color: '#e2e8f0',
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[9px] text-slate-400 font-bold">
                {d.name} <span className="text-white">{d.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
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
              type="monotone"
              dataKey="confidence_upper"
              stroke="none"
              fill="url(#forecastGrad)"
            />
            <Area type="monotone" dataKey="confidence_lower" stroke="none" fill="#0F172A" />
            <Line
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

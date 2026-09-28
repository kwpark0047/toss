import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Zap,
  Shield,
  Download,
  Settings,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Search,
  Filter,
  Calendar,
  Mail,
  Bell,
  ExternalLink,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { io } from 'socket.io-client';
import Icon from '@/components/ui/Icon';

function formatDate(date, formatStr) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const map = {
    'HH': pad(d.getHours()),
    'mm': pad(d.getMinutes()),
    'ss': pad(d.getSeconds()),
    'yyyy': d.getFullYear(),
    'MM': pad(d.getMonth() + 1),
    'dd': pad(d.getDate()),
  };
  return formatStr.replace(/HH|mm|ss|yyyy|MM|dd/g, m => map[m] || m);
}

const METRICS_WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:3000') + '/metrics';

const METRIC_CARDS = [
  { key: 'totalOrders', label: '총 주문 수', icon: ShoppingCart, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-600', trend: 'up', trendValue: '+12.5%' },
  { key: 'totalRevenue', label: '총 매출', icon: DollarSign, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-600', trend: 'up', trendValue: '+8.3%' },
  { key: 'activeCustomers', label: '활성 고객', icon: Users, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50', text: 'text-purple-600', trend: 'up', trendValue: '+5.1%' },
  { key: 'avgOrderValue', label: '평균 주문액', icon: BarChart3, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-600', trend: 'down', trendValue: '-2.1%' },
  { key: 'conversionRate', label: '전환율', icon: TrendingUp, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50', text: 'text-rose-600', trend: 'up', trendValue: '+1.8%' },
  { key: 'waitTime', label: '평균 대기시간', icon: Clock, color: 'from-sky-500 to-blue-500', bg: 'bg-sky-50', text: 'text-sky-600', trend: 'down', trendValue: '-15%' },
];

const TIME_RANGES = [
  { key: '1h', label: '최근 1시간', minutes: 60 },
  { key: '6h', label: '최근 6시간', minutes: 360 },
  { key: '24h', label: '최근 24시간', minutes: 1440 },
  { key: '7d', label: '최근 7일', minutes: 10080 },
  { key: '30d', label: '최근 30일', minutes: 43200 },
];

function MetricCard({ metric, value, trend, trendValue, loading, className = '' }) {
  const IconComponent = metric.icon;
  const trendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? 'text-emerald-500' : 'text-rose-500';

  return (
    <motion.div
      className={`glass-panel-dark p-6 rounded-2xl border border-white/5 bg-white/[0.02] relative overflow-hidden group ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity">
        <div className={`absolute inset-0 bg-gradient-to-br ${metric.color} blur-[100px]`} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center shadow-lg`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <span className={`text-xs font-bold uppercase tracking-widest ${metric.text}`}>
            {trendValue}
          </span>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-3/4 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-black text-white mb-2 tabular-nums">{value}</div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-bold ${metric.text}`}>{metric.label}</span>
              <span className={`flex items-center gap-1 ${trendColor}`}>
                <trendIcon size={14} />
                <span>{trendValue}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ConnectionStatus({ connected, latency }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
      <span className="text-xs font-bold text-white/80">
        {connected ? '실시간 연결됨' : '연결 끊김'}
      </span>
      {connected && latency && (
        <span className="text-xs text-slate-400 font-mono">{latency}ms</span>
      )}
    </div>
  );
}

function TimeRangeSelector({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
      {TIME_RANGES.map(range => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            selected === range.key
              ? 'bg-white text-slate-950 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

function ChartPlaceholder({ title, height = 300 }) {
  return (
    <div className="glass-panel-dark p-6 rounded-2xl border border-white/5 bg-white/[0.02] h-full">
      <h3 className="text-lg font-bold text-white mb-6">{title}</h3>
      <div className="h-[{height}px] flex items-center justify-center bg-white/5 rounded-xl">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">차트 데이터 로드 중...</p>
        </div>
      </div>
    </div>
  );
}

function LiveOrdersFeed({ orders }) {
  return (
    <div className="glass-panel-dark rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">실시간 주문 피드</h3>
        <span className="text-xs font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-xl uppercase tracking-widest">
          {orders.length}건
        </span>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>실시간 주문이 없습니다</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {orders.slice(0, 20).map((order, i) => (
              <motion.li
                key={order.id || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{order.storeName || '매장'}</p>
                      <p className="text-xs text-slate-400 truncate">{order.items?.length || 0}개 아이템</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-white tabular-nums">{order.amount?.toLocaleString()}원</p>
                    <p className="text-xs text-slate-500">{formatDate(new Date(order.createdAt), 'HH:mm:ss')}</p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TopProductsChart({ products }) {
  return (
    <div className="glass-panel-dark p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
      <h3 className="text-lg font-bold text-white mb-6">인기 메뉴 TOP 10</h3>
      <div className="space-y-3">
        {products.slice(0, 10).map((product, i) => (
          <motion.div
            key={product.id || i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-4"
          >
            <span className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 text-xs font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{product.name}</p>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${product.percentage}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="h-full bg-gradient-to-r from-orange-500 to-rose-500 rounded-full"
                />
              </div>
            </div>
            <span className="text-sm font-bold text-slate-400 shrink-0">{product.count}회</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function RealTimeAnalyticsDashboard() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('24h');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsLatency, setWsLatency] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState({});
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const storeId = currentStore?.id;

  const fetchAnalytics = useCallback(async () => {
    if (!storeId) return null;
    try {
      const { data } = await axios.get(`/api/stores/${storeId}/analytics`, {
        params: { range: timeRange },
      });
      return data;
    } catch (err) {
      console.error('Analytics fetch failed:', err);
      return null;
    }
  }, [storeId, timeRange]);

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['analytics', storeId, timeRange],
    queryFn: fetchAnalytics,
    enabled: !!storeId,
    refetchInterval: timeRange === '1h' ? 30000 : 60000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!storeId) return;

    const ws = io(METRICS_WS_URL, {
      transports: ['websocket', 'polling'],
      auth: { storeId },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    ws.on('connect', () => {
      setWsConnected(true);
      ws.emit('subscribe', { storeId, events: ['order', 'metric', 'alert'] });
    });

    ws.on('disconnect', () => setWsConnected(false));

    ws.on('metric', (data) => {
      setLiveMetrics(prev => ({ ...prev, ...data }));
    });

    ws.on('order', (order) => {
      setLiveOrders(prev => [order, ...prev.slice(0, 49)]);
    });

    ws.on('alert', (alert) => {
      console.log('Real-time alert:', alert);
    });

    ws.on('pong', (ts) => {
      setWsLatency(Date.now() - ts);
    });

    pingIntervalRef.current = setInterval(() => {
      if (ws.connected) ws.emit('ping', Date.now());
    }, 10000);

    wsRef.current = ws;

    return () => {
      clearInterval(pingIntervalRef.current);
      ws.disconnect();
    };
  }, [storeId]);

  const metrics = analytics?.metrics || liveMetrics;
  const orders = analytics?.recentOrders || [];

  const getMetricValue = (key, fallback = '0') => {
    const val = metrics[key];
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'number') {
      if (key.includes('Revenue') || key.includes('Value')) return `${val.toLocaleString()}원`;
      if (key.includes('Rate') || key.includes('Percent')) return `${val.toFixed(1)}%`;
      if (key.includes('Time') || key.includes('Wait')) return `${val}분`;
      return val.toLocaleString();
    }
    return String(val);
  };

  const getTrend = (key) => {
    const trend = metrics[`${key}Trend`];
    if (!trend) return { trend: 'up', trendValue: '+0%' };
    return {
      trend: trend.direction || 'up',
      trendValue: `${trend.direction === 'up' ? '+' : ''}${trend.value}%`,
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-orange-500 selection:text-white">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">실시간 분석 대시보드</h1>
              <p className="text-slate-400 mt-1 text-sm">
                {currentStore?.name} 매장의 실시간 비즈니스 지표 모니터링
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
              <ConnectionStatus connected={wsConnected} latency={wsLatency} />
              <button
                onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['analytics', storeId] }); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                <RefreshCw size={16} />
                새로고침
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8"
        >
          {METRIC_CARDS.map((metric, i) => {
            const { trend, trendValue } = getTrend(metric.key);
            return (
              <MetricCard
                key={metric.key}
                metric={metric}
                value={getMetricValue(metric.key)}
                trend={trend}
                trendValue={trendValue}
                loading={isLoading && !analytics}
              />
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        >
          <motion.div className="lg:col-span-2" layout>
            <LiveOrdersFeed orders={orders} />
          </motion.div>
          <motion.div layout>
            <TopProductsChart products={analytics?.topProducts || []} />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          <ChartPlaceholder title="시간대별 주문 추이" height={350} />
          <ChartPlaceholder title="카테고리별 매출 분포" height={350} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <ChartPlaceholder title="결제 수단별 분포" height={280} />
          <ChartPlaceholder title="고객 유입 경로" height={280} />
          <ChartPlaceholder title="시간대별 전환율" height={280} />
        </motion.div>
      </div>
    </div>
  );
}
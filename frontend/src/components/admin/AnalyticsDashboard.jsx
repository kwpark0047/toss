import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyticsAPI, storesAPI, staffAPI, exportAPI } from '../../api';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Award, Clock, BarChart3, PieChart, Calendar, ChevronRight, Activity, Zap, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, Legend
} from 'recharts';

/**
 * [정적 유틸리티] 차트용 단축 가격 포맷팅
 */
const formatCompactPrice = (price) => {
  if (price >= 10000000) {
    return (price / 10000000).toFixed(1) + '천만';
  } else if (price >= 10000) {
    return (price / 10000).toFixed(0) + '만';
  }
  return formatPrice(price);
};

const AnalyticsDashboard = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('daily');
  const [dateRange, setDateRange] = useState('30');
  const [salesData, setSalesData] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [products, setProducts] = useState(null);
  const [staffStats, setStaffStats] = useState(null);
  const [productSort, setProductSort] = useState('quantity');
  const [exporting, setExporting] = useState(null); // 현재 다운로드 중인 항목 key

  const getDateRange = () => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().slice(0, 10);
    return { start, end };
  };

  const handleExport = async (key, fn) => {
    if (exporting) return;
    setExporting(key);
    try { await fn(); }
    catch (e) { alert(e.message || '내보내기에 실패했습니다.'); }
    finally { setExporting(null); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInitialData(controller.signal);
    return () => controller.abort();
  }, [storeId]);

  useEffect(() => {
    if (myRole === 'owner') {
      const controller = new AbortController();
      fetchAnalytics(controller.signal);
      return () => controller.abort();
    }
  }, [period, dateRange, productSort, myRole]);

  const fetchInitialData = async (signal) => {
    try {
      const [storeRes, roleRes] = await Promise.all([
        storesAPI.getById(storeId, { signal }),
        staffAPI.getMyRole(storeId, { signal })
      ]);
      setStore(storeRes.data);
      setMyRole(roleRes.data.role);
      if (roleRes.data.role !== 'owner') {
        navigate('/admin');
      }
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;
      navigate('/admin');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const fetchAnalytics = async (signal) => {
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [salesRes, compRes, prodRes, staffRes] = await Promise.all([
        analyticsAPI.getSales(storeId, period, startDate, endDate, { signal }),
        analyticsAPI.getComparison(storeId, period === 'monthly' ? 'monthly' : 'weekly', { signal }),
        analyticsAPI.getProducts(storeId, startDate, endDate, 10, productSort, { signal }),
        staffAPI.getDetailedStats ? staffAPI.getDetailedStats(storeId, startDate, endDate, { signal }) : analyticsAPI.getStaff(storeId, startDate, endDate, { signal })
      ]);

      setSalesData(salesRes.data);
      setComparison(compRes.data);
      setProducts(prodRes.data);
      setStaffStats(staffRes.data);
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;
    }
  };

  const { maxSales, salesGrowthPositive, ordersGrowthPositive } = useMemo(() => {
    return {
      maxSales: salesData?.data ? Math.max(...salesData.data.map(d => d.sales), 1) : 1,
      salesGrowthPositive: (comparison?.growth?.sales || 0) >= 0,
      ordersGrowthPositive: (comparison?.growth?.orders || 0) >= 0
    };
  }, [salesData, comparison]);

  const getGrowthBarWidth = useMemo(() => (value) => {
    if (!value || isNaN(value)) return 0;
    return Math.min(Math.abs(value), 100);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full"
        />
        <p className="text-slate-500 font-black tracking-widest text-xs uppercase animate-pulse">Analyzing Performance Data...</p>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-[1600px] mx-auto space-y-10 px-4 pb-20"
    >
      {/* 프리미엄 헤더 */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/admin')}
            className="w-14 h-14 bg-white/5 rounded-[20px] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-2xl backdrop-blur-xl"
          >
            <ArrowLeft size={24} />
          </motion.button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">데이터 인사이트</h1>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={12} /> {store?.name}
                </p>
              </div>
              <span className="text-slate-600 font-bold text-xs uppercase tracking-tighter">Business Analytics Dashboard</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-orange-500 transition-colors" size={18} />
            <select aria-label="기간 선택"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black text-white outline-none focus:border-orange-500/50 appearance-none transition-all"
            >
              <option value="7" className="bg-slate-900">최근 7일</option>
              <option value="30" className="bg-slate-900">최근 30일</option>
              <option value="90" className="bg-slate-900">최근 90일</option>
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" size={16} />
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${period === p 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {p === 'daily' ? 'DAILY' : p === 'weekly' ? 'WEEKLY' : 'MONTHLY'}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* 핵심 지표 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: '누적 매출액', value: formatPrice(salesData?.summary?.total_sales || 0, true), icon: DollarSign, color: 'from-orange-500 to-rose-600', shadow: 'shadow-orange-500/20' },
          { label: '누적 주문수', value: `${salesData?.summary?.total_orders || 0}건`, icon: ShoppingBag, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
          { 
            label: '성장률 (전기간)', 
            value: `${salesGrowthPositive ? '+' : ''}${comparison?.growth?.sales || 0}%`, 
            icon: salesGrowthPositive ? TrendingUp : TrendingDown, 
            color: salesGrowthPositive ? 'from-emerald-500 to-teal-600' : 'from-rose-500 to-red-600',
            shadow: salesGrowthPositive ? 'shadow-emerald-500/20' : 'shadow-rose-500/20',
            isGrowth: true
          },
          { label: '객단가 (평균)', value: formatPrice(salesData?.summary?.avg_order_amount || 0, true), icon: Zap, color: 'from-purple-500 to-fuchsia-600', shadow: 'shadow-purple-500/20' }
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            variants={itemVariants}
            className="group relative bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/5 p-8 overflow-hidden hover:border-white/10 transition-all"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 -mr-16 -mt-16 rounded-full blur-3xl transition-all duration-700`} />
            <div className="relative z-10">
              <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl ${stat.shadow}`}>
                <stat.icon size={28} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</span>
              <p className={`text-3xl font-black mt-2 tracking-tight ${stat.isGrowth ? (salesGrowthPositive ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
                {stat.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 메인 매출 추이 차트 섹션 (Placeholder for next step) */}
           {/* Chart content will be replaced in next step */}

        {/* 기간 비교 사이드 패널 */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-8">
          <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                <Clock className="text-orange-500" size={20} /> 기간 성장 분석
              </h2>
              
              <div className="space-y-6">
                <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Growth Forecast</span>
                    <span className={`text-lg font-black ${salesGrowthPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {salesGrowthPositive ? '+' : ''}{comparison?.growth?.sales?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: getGrowthBarWidth(comparison?.growth?.sales) + '%' }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className={`h-full rounded-full ${salesGrowthPositive ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-red-400'}`}
                    />
                  </div>
                </div>

                <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order Expansion</span>
                    <span className={`text-lg font-black ${ordersGrowthPositive ? 'text-blue-400' : 'text-rose-400'}`}>
                      {ordersGrowthPositive ? '+' : ''}{comparison?.growth?.orders?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: getGrowthBarWidth(comparison?.growth?.orders) + '%' }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                      className={`h-full rounded-full ${ordersGrowthPositive ? 'bg-gradient-to-r from-blue-500 to-indigo-400' : 'bg-gradient-to-r from-rose-500 to-red-400'}`}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Period</p>
                    <p className="text-sm font-black text-white">{formatPrice(comparison?.current?.sales || 0, true)}</p>
                  </div>
                  <ChevronRight className="text-slate-700" size={20} />
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Benchmark</p>
                    <p className="text-sm font-black text-slate-400">{formatPrice(comparison?.previous?.sales || 0, true)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {salesData?.summary?.best_day && (
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-orange-500 to-rose-600 rounded-[40px] p-10 text-white shadow-2xl shadow-orange-500/20"
            >
              <Award className="mb-6 opacity-50" size={32} />
              <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-2">Record High Performance</p>
              <h3 className="text-2xl font-black mb-1">{salesData.summary.best_day.date}</h3>
              <p className="text-4xl font-black tracking-tight">{formatPrice(salesData.summary.best_day.sales, true)}</p>
            </motion.div>
          )}
        </motion.div>


        {/* 메인 매출 추이 차트 */}
        <motion.div variants={itemVariants} className="lg:col-span-8 bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">비즈니스 퍼포먼스</h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Revenue & Transaction Trend</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
              </div>
            </div>
          </div>

          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData?.data || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 800 }}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 800 }}
                  tickFormatter={(val) => formatCompactPrice(val)}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    borderRadius: '24px', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '20px',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900' }}
                  labelStyle={{ color: '#64748B', marginBottom: '8px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  formatter={(value) => [formatPrice(value, true), 'REVENUE']}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#F97316"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 시간대별 활동 */}
        <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl">
          <h3 className="text-xl font-black text-white tracking-tight mb-10 flex items-center gap-3">
            <Clock className="text-blue-500" size={20} /> 시간대별 활동 분포
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData?.hourly || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 800 }} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: '900' }}
                  formatter={(value) => [formatPrice(value, true), 'REVENUE']}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {(salesData?.hourly || []).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.amount > (salesData?.summary?.total_sales / 24) ? '#3B82F6' : '#1E293B'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 요일별 매출 비중 */}
        <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl">
          <h3 className="text-xl font-black text-white tracking-tight mb-10 flex items-center gap-3">
            <PieChart className="text-purple-500" size={20} /> 요일별 매출 포트폴리오
          </h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={salesData?.dayOfWeek || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="amount"
                  nameKey="day"
                  animationDuration={2000}
                >
                  {(salesData?.dayOfWeek || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#F97316', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6', '#6366F1', '#F43F5E'][index % 7]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: '900' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: '900', fontSize: '10px' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 인기 메뉴 */}
        <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              <Award className="text-amber-400" size={22} /> TOP 10 실적 메뉴
            </h2>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
              {['quantity', 'sales'].map((s) => (
                <button
                  key={s}
                  onClick={() => setProductSort(s)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${productSort === s ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {s === 'quantity' ? 'UNIT VOLUME' : 'REVENUE'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {products?.products?.length > 0 ? (
              products.products.map((item, idx) => (
                <div key={item.product_id} className="flex items-center gap-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/5 transition-all">
                  <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-sm ${idx < 3 ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20' : 'bg-slate-800 text-slate-500'}`}>
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-black text-white group-hover:text-amber-400 transition-colors truncate">{item.product_name}</span>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{formatPrice(item.total_sales, true)}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{item.total_quantity} UNITS SOLD</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30">
                <BarChart3 className="mx-auto mb-4" size={48} />
                <p className="text-xs font-black tracking-widest uppercase">No Product Data Available</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* 직원 성과 */}
        <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white tracking-tight mb-10 flex items-center gap-3">
            <Users className="text-indigo-400" size={22} /> 직원 퍼포먼스 순위
          </h2>

          <div className="space-y-4">
            {staffStats?.staff?.length > 0 ? (
              staffStats.staff.map((member, idx) => (
                <div key={member.id} className="flex items-center gap-6 p-5 bg-white/[0.02] border border-white/5 rounded-3xl group hover:bg-white/5 transition-all">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-2xl font-black text-lg ${idx === 0 ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white group-hover:text-indigo-400 transition-colors">{member.name}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{member.role_label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{member.orders_processed} ORDERS</p>
                    <p className="text-[10px] font-black text-indigo-500/50 uppercase tracking-widest">{formatPrice(member.total_sales, true)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center">
                <Users className="text-slate-800 mb-6" size={64} />
                <h4 className="text-slate-600 font-black mb-1">성과 기록이 없습니다</h4>
                <p className="text-slate-700 text-xs font-bold uppercase tracking-widest">Employee activity will appear here</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── 내보내기 패널 ── */}
      <motion.div variants={itemVariants} className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Download className="text-orange-400" size={22} />
          <h2 className="text-xl font-black text-white tracking-tight">데이터 내보내기</h2>
          <span className="ml-auto text-[10px] font-black text-slate-500 uppercase tracking-widest">조회 기간 {dateRange}일 기준</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Excel 카드 */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileSpreadsheet className="text-emerald-400" size={18} />
              <span className="text-sm font-black text-white">Excel 다운로드</span>
              <span className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-400 font-black px-2 py-0.5 rounded-full uppercase">.xlsx</span>
            </div>
            <div className="space-y-2">
              {[
                { key: 'sales', label: '📊 매출 통계', desc: '일별·시간대·요일·결제수단 4개 시트', fn: () => { const {start,end}=getDateRange(); return exportAPI.salesExcel(storeId,start,end); } },
                { key: 'orders', label: '📋 주문 내역', desc: '기간 내 전체 주문 상세 목록', fn: () => { const {start,end}=getDateRange(); return exportAPI.ordersExcel(storeId,start,end); } },
                { key: 'menu', label: '🍽️ 메뉴 분석', desc: 'ABC 등급·판매량·매출 비중', fn: () => { const {start,end}=getDateRange(); return exportAPI.menuExcel(storeId,start,end); } },
                { key: 'customers', label: '👥 단골 고객', desc: '방문횟수·누적결제·등급 전체', fn: () => exportAPI.customersExcel(storeId) },
              ].map(({ key, label, desc, fn }) => (
                <button
                  key={key}
                  onClick={() => handleExport(key, fn)}
                  disabled={!!exporting}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left
                    ${exporting === key
                      ? 'bg-emerald-500/20 border-emerald-500/40 cursor-wait'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-emerald-500/30 cursor-pointer'
                    } ${exporting && exporting !== key ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <p className="text-sm font-black text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{desc}</p>
                  </div>
                  {exporting === key
                    ? <span className="text-[10px] text-emerald-400 font-black animate-pulse">생성 중...</span>
                    : <Download size={14} className="text-slate-500 group-hover:text-emerald-400" />
                  }
                </button>
              ))}
            </div>
          </div>

          {/* PDF 카드 */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="text-orange-400" size={18} />
              <span className="text-sm font-black text-white">PDF 다운로드</span>
              <span className="ml-auto text-[9px] bg-orange-500/20 text-orange-400 font-black px-2 py-0.5 rounded-full uppercase">.pdf</span>
            </div>
            <div className="space-y-2">
              {[
                {
                  key: 'pdf-report',
                  label: '📄 종합 보고서',
                  desc: '핵심 지표 · TOP5 메뉴 · 결제수단 · 단골 고객 한 장 요약',
                  fn: () => { const {start,end}=getDateRange(); return exportAPI.reportPdf(storeId,start,end); }
                },
              ].map(({ key, label, desc, fn }) => (
                <button
                  key={key}
                  onClick={() => handleExport(key, fn)}
                  disabled={!!exporting}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left
                    ${exporting === key
                      ? 'bg-orange-500/20 border-orange-500/40 cursor-wait'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-orange-500/30 cursor-pointer'
                    } ${exporting && exporting !== key ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <p className="text-sm font-black text-white">{label}</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{desc}</p>
                  </div>
                  {exporting === key
                    ? <span className="text-[10px] text-orange-400 font-black animate-pulse">생성 중...</span>
                    : <Download size={14} className="text-slate-500" />
                  }
                </button>
              ))}

              <div className="mt-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="text-[10px] text-orange-300/70 font-bold leading-relaxed">
                  💡 종합 보고서는 현재 선택된 조회 기간({dateRange}일)을 기준으로 생성됩니다.
                  상단의 기간 설정을 변경한 후 다운로드하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
};

export default AnalyticsDashboard;


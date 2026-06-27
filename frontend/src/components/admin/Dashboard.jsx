import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { storesAPI, ordersAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { formatPrice } from '../../utils/format';
import { motion } from 'framer-motion';
import { 
  Store, ShoppingBag, DollarSign, Clock, Plus, ChevronRight, 
  BarChart3, Users, TrendingUp, Sparkles, Activity, Target
} from 'lucide-react';

/**
 * 프리미엄 다크 디자인이 적용된 관리자 메인 대시보드
 * 글래스모피즘 카드와 다이내믹한 통계를 제공합니다.
 */
const Dashboard = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    try {
      const res = await storesAPI.getMy();
      setStores(res.data);
      if (res.data.length > 0) {
        setSelectedStore(res.data[0]);
      }
    } catch (error) {
      console.error('매장 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStoreData = useCallback(async (storeId) => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        ordersAPI.getStats(storeId),
        ordersAPI.getByStore(storeId),
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 5));
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (selectedStore) {
      fetchStoreData(selectedStore.id);
    }
  }, [selectedStore, fetchStoreData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20 bg-white/5 rounded-[40px] border border-white/5 backdrop-blur-xl"
      >
        <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <Store className="text-slate-600" size={48} />
        </div>
        <h2 className="text-3xl font-black text-white mb-4">등록된 매장이 없습니다</h2>
        <p className="text-slate-400 mb-10 max-w-sm mx-auto font-medium">위마켓의 스마트한 매장 관리를 시작하려면<br/>첫 번째 매장을 등록해 주세요.</p>
        <Link
          to="/admin/stores/new"
          className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-[24px] font-black shadow-2xl shadow-orange-500/30 hover:scale-105 transition-transform"
        >
          <Plus size={22} />
          매장 등록하기
        </Link>
      </motion.div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-10">
      {/* 상단 헤더 & 매장 선택 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">커맨드 센터</h1>
          <p className="text-slate-500 font-medium">실시간 매장 운영 현황을 한눈에 파악하세요.</p>
        </div>
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <select
            value={selectedStore?.id || ''}
            onChange={(e) => {
              const store = stores.find((s) => s.id === parseInt(e.target.value));
              setSelectedStore(store);
            }}
            className="relative w-full md:w-64 px-6 py-4 bg-slate-900 border border-white/10 rounded-2xl text-white font-black focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={20} />
        </div>
      </div>

      {/* 실시간 주요 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: '오늘 주문', value: stats?.total_orders || 0, icon: ShoppingBag, color: 'orange', suffix: '건' },
          { label: '오늘 매출', value: stats?.total_sales || 0, icon: DollarSign, color: 'emerald', isPrice: true },
          { label: '현재 대기', value: stats?.by_status?.pending || 0, icon: Clock, color: 'indigo', suffix: '팀' },
          { label: '진행 중', value: stats?.by_status?.preparing || 0, icon: Activity, color: 'rose', suffix: '건' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            variants={item}
            whileHover={{ y: -5 }}
            className="bg-white/5 backdrop-blur-xl rounded-[32px] p-8 border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 rounded-full -mr-16 -mt-16 blur-3xl`} />
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 mb-6 shadow-inner`}>
                <stat.icon size={28} />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">
                  {stat.isPrice ? formatPrice(stat.value).replace('원', '') : stat.value}
                </span>
                <span className="text-sm font-bold text-slate-500">{stat.isPrice ? '원' : stat.suffix}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* 최근 주문 현황 */}
        <motion.div variants={item} className="lg:col-span-8 bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/5 overflow-hidden">
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Target size={22} />
              </div>
              <h2 className="text-xl font-black text-white">최근 주문 현황</h2>
            </div>
            <Link
              to={'/admin/stores/' + selectedStore?.id + '/orders'}
              className="px-4 py-2 bg-white/5 rounded-xl text-xs font-black text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              전체 보기
            </Link>
          </div>
          <div className="p-4">
            {recentOrders.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center text-2xl mb-4">😶</div>
                <p className="text-slate-500 font-bold">아직 접수된 주문이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order, idx) => (
                  <div key={order.id} className="p-5 flex justify-between items-center bg-white/[0.02] hover:bg-white/5 rounded-3xl border border-transparent hover:border-white/5 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-black text-xs shadow-inner">
                        #{order.order_number}
                      </div>
                      <div>
                        <p className="font-black text-white group-hover:text-orange-400 transition-colors">
                          {order.table_name || '포장 주문'}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {formatPrice(order.total_amount)} · 주문 {idx + 1}분 전
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${
                        order.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        order.status === 'preparing' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}
                    >
                      {order.status === 'pending' ? '대기 중' : order.status === 'preparing' ? '조리 중' : '완료'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* 퀵 액션 그리드 */}
        <motion.div variants={item} className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: '메뉴 매니저', path: `/admin/stores/${selectedStore?.id}/menu`, icon: UtensilsCrossed, color: 'rose' },
              { label: '직원 워크플로우', path: `/admin/stores/${selectedStore?.id}/staff`, icon: Users, color: 'indigo' },
              { label: '시각적 분석', path: `/admin/stores/${selectedStore?.id}/stats`, icon: BarChart3, color: 'orange' },
            ].map((action, i) => (
              <Link
                key={i}
                to={action.path}
                className="group relative p-6 bg-white/5 backdrop-blur-xl border border-white/5 rounded-[32px] hover:bg-white/10 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl bg-${action.color}-500/10 flex items-center justify-center text-${action.color}-500 group-hover:scale-110 transition-transform`}>
                    <action.icon size={22} />
                  </div>
                  <span className="font-black text-white tracking-tight">{action.label}</span>
                </div>
                <ChevronRight size={20} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>

          <Link
            to={'/admin/stores/' + selectedStore?.id + '/analytics'}
            className="block group relative p-8 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[40px] shadow-2xl shadow-indigo-500/20 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-indigo-200 animate-pulse" />
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em]">Premium Insight</span>
              </div>
              <h3 className="text-2xl font-black text-white mb-4 leading-tight">AI 비즈니스<br/>심층 분석 리포트</h3>
              <p className="text-sm font-medium text-indigo-100/70 mb-6">데이터 기반의 매출 예측과<br/>최적화된 메뉴 구성을 제안합니다.</p>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-xs">
                리포트 확인하기
                <ChevronRight size={14} />
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;


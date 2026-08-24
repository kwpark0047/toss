import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { ordersAPI, storesAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import Skeleton from '../common/Skeleton';
import Icon from '../../components/ui/Icon';
import { RefreshCw } from 'lucide-react';

const SalesStats = () => {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

  const getDateRange = useCallback(() => {
    const today = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'today':
        startDate = endDate = today.toISOString().split('T')[0];
        break;
      case 'week': {
        endDate = today.toISOString().split('T')[0];
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        endDate = today.toISOString().split('T')[0];
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 29);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      }
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        endDate = today.toISOString().split('T')[0];
        startDate = endDate;
    }

    return { startDate, endDate };
  }, [dateRange, customStartDate, customEndDate]);

  const fetchStore = useCallback(async (signal) => {
    try {
      const res = await storesAPI.getById(storeId, { signal });
      setStore(res.data);
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;
      console.error('Store fetch error:', error);
    }
  }, [storeId]);

  const fetchStats = useCallback(async (signal) => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();
      if (!startDate || !endDate) {
        setLoading(false);
        return;
      }
      const res = await ordersAPI.getDetailedStats(storeId, startDate, endDate, { signal });
      setStats(res.data);
    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;
      console.error('Stats fetch error:', error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [storeId, getDateRange]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStore(controller.signal);
    return () => controller.abort();
  }, [fetchStore]);

  useEffect(() => {
    if (dateRange !== 'custom' || (customStartDate && customEndDate)) {
      const controller = new AbortController();
      fetchStats(controller.signal);
      return () => controller.abort();
    }
  }, [fetchStats, dateRange, customStartDate, customEndDate]);

  /**
   * [성능 최적화] 차트 시각화를 위한 일별/시간대별 최대 매출액 계산 (Memoized)
   */
  const { maxSales, maxHourlySales } = useMemo(() => {
    return {
      maxSales: stats?.daily_sales?.length ? Math.max(...stats.daily_sales.map(d => d.sales)) : 0,
      maxHourlySales: stats?.hourly_sales?.length ? Math.max(...stats.hourly_sales.map(d => d.sales)) : 0
    };
  }, [stats]);

  // 결제 방법 한글화
  const getPaymentMethodName = (method) => {
    const names = {
      card: '카드',
      cash: '현금',
      kakao: '카카오페이',
      naver: '네이버페이',
      unknown: '기타'
    };
    return names[method] || method;
  };

  // 날짜 포맷
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (loading && !stats) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton dark className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} dark className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton dark className="h-64 rounded-2xl" />
      </div>
    );
  }


  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <Icon icon="ArrowLeft" size="md" className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">매출 통계</h1>
            <p className="text-slate-400 text-sm">{store?.name}</p>
          </div>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          <span className="font-medium">새로고침</span>
        </button>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-2xl shadow-soft p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[
              { key: 'today', label: '오늘' },
              { key: 'week', label: '7일' },
              { key: 'month', label: '30일' },
              { key: 'custom', label: '직접선택' }
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setDateRange(item.key)}
                className={'px-4 py-2 rounded-lg font-medium text-sm transition-all ' +
                  (dateRange === item.key ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700')}
              >
                {item.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-soft p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <Icon icon="DollarSign" size="md" className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">총 매출</p>
          <p className="text-2xl font-bold text-slate-900">{formatPrice(stats?.summary?.total_sales, true)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <Icon icon="ShoppingBag" size="md" className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">총 주문</p>
          <p className="text-2xl font-bold text-slate-900">{formatNumber(stats?.summary?.total_orders)}건</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <Icon icon="TrendingUp" size="md" className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">평균 주문금액</p>
          <p className="text-2xl font-bold text-slate-900">{formatPrice(Math.round(stats?.summary?.avg_order_amount || 0), true)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
              <Icon icon="BarChart3" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-1">완료율</p>
          <p className="text-2xl font-bold text-slate-900">
            {stats?.summary?.total_orders > 0
              ? Math.round((stats.summary.completed_orders / stats.summary.total_orders) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 일별 매출 차트 */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon icon="BarChart3" />
            일별 매출
          </h3>
          {stats?.daily_sales?.length > 0 ? (
            <div className="space-y-3">
              {stats.daily_sales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-slate-500 flex-shrink-0">{formatDate(day.date)}</span>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: maxSales > 0 ? `${Math.max((day.sales / maxSales) * 100, 5)}%` : '5%' }}
                    >
                      {day.sales > 0 && (
                        <span className="text-xs text-white font-medium">{formatPrice(day.sales, true)}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-10 text-sm text-slate-400 text-right">{day.order_count}건</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">데이터가 없습니다</div>
          )}
        </div>

        {/* 시간대별 매출 */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon icon="Clock" size="md" className="w-5 h-5 text-blue-500" />
            시간대별 매출
          </h3>
          {stats?.hourly_sales?.length > 0 ? (
            <div className="flex items-end gap-1 h-48">
              {Array.from({ length: 24 }, (_, i) => {
                const hourData = stats.hourly_sales.find(h => parseInt(h.hour) === i);
                const sales = hourData?.sales || 0;
                const height = maxHourlySales > 0 ? (sales / maxHourlySales) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500 hover:from-blue-600 hover:to-blue-500 group relative"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${i}시: ${formatPrice(sales, true)}`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {formatPrice(sales, true)}
                      </div>
                    </div>
                    {i % 4 === 0 && (
                      <span className="text-xs text-slate-400">{i}시</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">데이터가 없습니다</div>
          )}
        </div>
      </div>

      {/* 인기 메뉴 & 결제 방법 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 인기 메뉴 */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon icon="Award" />
            인기 메뉴 TOP 10
          </h3>
          {stats?.top_products?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_products.map((product, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={
                    'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ' +
                    (idx === 0 ? 'bg-yellow-100 text-yellow-600' :
                      idx === 1 ? 'bg-gray-200 text-gray-600' :
                        idx === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-500')
                  }>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{product.product_name}</p>
                    <p className="text-sm text-slate-400">{formatPrice(product.total_sales, true)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{product.total_quantity}개</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">데이터가 없습니다</div>
          )}
        </div>

        {/* 결제 방법별 통계 */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Icon icon="PieChart" size="md" className="w-5 h-5 text-purple-500" />
            결제 방법별 통계
          </h3>
          {stats?.payment_stats?.length > 0 ? (
            <div className="space-y-4">
              {stats.payment_stats.map((payment, idx) => {
                const totalPayments = stats.payment_stats.reduce((sum, p) => sum + p.total, 0);
                const percentage = totalPayments > 0 ? Math.round((payment.total / totalPayments) * 100) : 0;
                const colors = ['from-purple-400 to-purple-500', 'from-blue-400 to-blue-500', 'from-green-400 to-green-500', 'from-yellow-400 to-yellow-500'];
                return (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-slate-700">{getPaymentMethodName(payment.method)}</span>
                      <div className="text-right">
                        <span className="text-slate-900 font-bold">{formatPrice(payment.total, true)}</span>
                        <span className="text-slate-400 text-sm ml-2">({payment.count}건)</span>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors[idx % colors.length]} rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-right text-xs text-slate-400 mt-1">{percentage}%</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">데이터가 없습니다</div>
          )}
        </div>
      </div>

      {/* 추가 통계 정보 */}
      <div className="mt-6 bg-white rounded-2xl shadow-soft p-6">
        <h3 className="font-bold text-slate-900 mb-4">주문 상태 요약</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{formatNumber(stats?.summary?.completed_orders)}</p>
            <p className="text-sm text-green-700 mt-1">완료된 주문</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <p className="text-3xl font-bold text-red-600">{formatNumber(stats?.summary?.cancelled_orders)}</p>
            <p className="text-sm text-red-700 mt-1">취소된 주문</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{formatNumber(stats?.summary?.total_orders)}</p>
            <p className="text-sm text-blue-700 mt-1">전체 주문</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <p className="text-3xl font-bold text-purple-600">
              {stats?.summary?.total_orders > 0 && stats?.summary?.cancelled_orders
                ? (100 - Math.round((stats.summary.cancelled_orders / stats.summary.total_orders) * 100))
                : 100}%
            </p>
            <p className="text-sm text-purple-700 mt-1">주문 성공률</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesStats;

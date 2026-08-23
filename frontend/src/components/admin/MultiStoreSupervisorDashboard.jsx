import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Building2,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Calendar,
  RefreshCw,
  Layers,
  ChevronRight,
  Store,
  Package,
  Megaphone,
  Activity,
import { formatPrice } from '../../utils/format';
import { toast } from 'react-toastify';
import { vibrateShort } from '../../utils/notificationSound';
import { analyticsAPI } from '../../api/misc';
import Icon from '../ui/Icon';
export default function MultiStoreSupervisorDashboard() {
  const [data, setData] = useState({
    summary: {
      total_sales: 0,
      total_orders: 0,
      store_count: 0,
    },
    stores: [],
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // 기본 지난 30일
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 정산 대사 대조 체크 상태 관리용 맵
  const [reconciledMap, setReconciledMap] = useState({});

  // 통합 다점포 매출 분석 조회
  const fetchMultiStoreStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await analyticsAPI.getMultiStore({ start_date: startDate, end_date: endDate });
      setData(
        res.data?.data ||
          res.data || {
            summary: {
              total_sales: 0,
              total_orders: 0,
              store_count: 0,
            },
            stores: [],
          }
      );
    } catch (err) {
      console.error('[Supervisor] Fetch Error:', err);
    } finally {
      if (typeof setLoading === 'function') setLoading(false);
    }
  }, [startDate, endDate]);
  useEffect(() => {
    fetchMultiStoreStats();
  }, [fetchMultiStoreStats]);
  const summary = useMemo(
    () =>
      data.summary || {
        total_sales: 0,
        total_orders: 0,
        store_count: 0,
      },
    [data]
  );
  const stores = useMemo(() => data.stores || [], [data]);

  // 평균 객단가 계산 (Combined Average Ticket Size)
  const averageTicketSize = useMemo(() => {
    if (!summary.total_orders) return 0;
    return Math.round(summary.total_sales / summary.total_orders);
  }, [summary.total_sales, summary.total_orders]);

  // 가장 매출이 높은 매장 탐색
  const topStore = useMemo(() => {
    if (stores.length === 0) return null;
    return [...stores].sort((a, b) => b.total_sales - a.total_sales)[0];
  }, [stores]);

  // 원클릭 대사 대조 토글 핸들러
  const toggleReconcile = (storeId, storeName) => {
    setReconciledMap((prev) => {
      const next = {
        ...prev,
        [storeId]: !prev[storeId],
      };
      const isChecking = next[storeId];
      if (isChecking) {
        toast.success(`[${storeName}] 지점의 자금 대사 대조 검증이 원클릭 완료 처리되었습니다. 💵`);
      }
      return next;
    });
    try {
      vibrateShort();
    } catch (_) {}
  };
  return (
    <div className="space-y-8 text-slate-100 max-w-7xl mx-auto p-1 select-none">
      {/* 1. 최상단 통합 헤더바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
              <Icon icon="Building2" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              통합 브랜드 어드민
              <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Franchise Supervisor Console
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            소유하거나 운영 권한이 있는 모든 브랜드 매장의 라이브 매출 및 조리 주문 상태를 실시간
            통합 모니터링합니다.
          </p>
        </div>

        {/* 대기 주문 검색 바 및 기간 필터 */}
        <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-850 p-1.5 rounded-2xl flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 font-bold">
            <Icon icon="Calendar" size="md" className="size-4" />
            <span>분석 기간</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/5 transition-all"
          />
          <span className="text-slate-600 text-xs">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/5 transition-all"
          />
          <button
            onClick={fetchMultiStoreStats}
            disabled={loading}
            className="w-10 h-10 rounded-xl border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center bg-slate-950 active:scale-95"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. 최상단 3-Column 통합 금융 KPI 카드 모듈 */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: 다점포 합산 총 매출 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              통합 브랜드 총 매출
            </span>
            <DollarSign className="text-orange-500" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {formatPrice(summary.total_sales, true)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SLA 가동률 보장 실거래 집계치
            </p>
          </div>
        </div>

        {/* KPI 2: 합산 주문량 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              통합 누적 주문 수량
            </span>
            <ShoppingCart className="text-blue-400" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {summary.total_orders?.toLocaleString()}{' '}
              <span className="text-lg font-bold text-slate-400">건</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
              활성 매장 수 :{' '}
              <span className="text-blue-400 font-bold font-mono">{summary.store_count}</span>개
              점포
            </p>
          </div>
        </div>

        {/* KPI 3: 평균 객단가 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              평균 테이블 객단가
            </span>
            <TrendingUp className="text-emerald-400" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {formatPrice(averageTicketSize, true)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
              최고 실적 매장 :{' '}
              <span className="text-emerald-400 font-black">
                {topStore ? topStore.store_name : 'N/A'}
              </span>
            </p>
          </div>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">저재고</span><Package className="text-amber-400" size={18} /></div>
          <h3 className="text-2xl font-black font-mono text-amber-300">{summary.low_stock_count ?? 0}<span className="text-sm ml-1 text-slate-400">개</span></h3>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">발주 대기</span><TrendingUp className="text-orange-400" size={18} /></div>
          <h3 className="text-2xl font-black font-mono text-orange-300">{summary.pending_reorders ?? 0}<span className="text-sm ml-1 text-slate-400">건</span></h3>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">활성 CRM</span><Icon icon="Megaphone" /></div>
          <h3 className="text-2xl font-black font-mono text-indigo-300">{summary.active_campaigns ?? 0}<span className="text-sm ml-1 text-slate-400">건</span></h3>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">24시간 이벤트</span><Activity className="text-cyan-400" size={18} /></div>
          <h3 className="text-2xl font-black font-mono text-cyan-300">{summary.events_24h ?? 0}<span className="text-sm ml-1 text-slate-400">건</span></h3>
        </div>
      </div>

      {/* 3. 매장 매출 비교 차트 시각화 레이어 */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <Layers className="text-orange-500" size={16} />
              지점별 매출 분포 가시화 데이터
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Store-by-Store Sales Shares
            </p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono font-bold">
            TOTAL : {stores.length} STORES
          </span>
        </div>

        {stores.length === 0 ? (
          <div className="text-center py-10 text-slate-650 text-xs font-semibold">
            조회 기간에 결제된 내역이 없어 매출 비율 그래프를 그릴 수 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {stores.map((st) => {
              // 해당 매장의 매출이 총 매출에서 차지하는 비율 계산
              const sharePercent =
                summary.total_sales > 0
                  ? Math.round((st.total_sales / summary.total_sales) * 100)
                  : 0;
              return (
                <div key={st.store_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{st.store_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 font-bold">
                        {st.total_orders}건
                      </span>
                      <span className="font-mono font-bold text-orange-400">
                        {formatPrice(st.total_sales, true)} ({sharePercent}%)
                      </span>
                    </div>
                  </div>
                  {/* 정밀 가로 그래프 바 */}
                  <div className="h-4 bg-slate-950/80 rounded-lg overflow-hidden border border-slate-850/60 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-rose-600 rounded-md transition-all duration-1000"
                      style={{
                        width: `${Math.max(1, sharePercent)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 다점포 통합 자금 정산 대사 매니저 (Reconciliation - 패널 신설) */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 space-y-4 shadow-2xl">
        <div className="space-y-0.5">
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <Layers className="text-orange-500" size={16} />
            프랜차이즈 정산 대사 매니저 (SaaS Fee Calculator)
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Settlement & Commission Reconciliation
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-850/60 rounded-2xl bg-slate-950/40">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-850/60 text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/30">
                <th className="p-4">지점명</th>
                <th className="p-4 text-right">총 매출</th>
                <th className="p-4 text-right">플랫폼 수수료 (3%)</th>
                <th className="p-4 text-right">수수료 부가세 (10%)</th>
                <th className="p-4 text-right">PG 카드수수료 (2%)</th>
                <th className="p-4 text-right">점주 예상 정산액</th>
                <th className="p-4 text-center">대사 대조</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40 text-xs font-medium">
              {stores.map((st) => {
                const total = st.total_sales;
                const commission = Math.round(total * 0.03);
                const vat = Math.round(commission * 0.1);
                const cardFee = Math.round(total * 0.02);
                const netPayout = total - commission - vat - cardFee;
                const isReconciled = reconciledMap[st.store_id];
                return (
                  <tr
                    key={st.store_id}
                    className={`hover:bg-white/[0.01] transition-colors ${isReconciled ? 'opacity-50' : ''}`}
                  >
                    <td className="p-4 font-bold text-slate-200">{st.store_name}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-300 tabular-nums">
                      {formatPrice(total, true)}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400 tabular-nums">
                      {formatPrice(commission, true)}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 tabular-nums">
                      {formatPrice(vat, true)}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 tabular-nums">
                      {formatPrice(cardFee, true)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                      {formatPrice(netPayout, true)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleReconcile(st.store_id, st.store_name)}
                        className={`w-24 h-10 rounded-xl text-[10px] font-black tracking-wider transition-all active:scale-95 border ${isReconciled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'}`}
                      >
                        {isReconciled ? '✓ 대사완료' : '대조 체크'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 지점별 통합 모니터링 카드 덱 그리드 */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-white flex items-center gap-1.5">
          <Store className="text-orange-500" size={16} />
          지점별 라이브 대시보드
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stores.length === 0 ? (
            <div className="col-span-2 p-10 bg-slate-900/30 border border-slate-900 rounded-3xl text-center text-slate-500 text-xs font-semibold">
              등록된 매장 데이터가 없습니다. 매장 개설 마법사를 통해 첫 매장을 등록해 주세요.
            </div>
          ) : (
            stores.map((st) => (
              <div
                key={st.store_id}
                className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-3xl p-6 transition-all hover:scale-[1.01] flex flex-col justify-between h-48 shadow-xl"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      {st.store_name}
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                      STORE_ID : {st.store_id}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black block uppercase tracking-widest">
                      누적 매출
                    </span>
                    <span className="text-sm font-mono font-bold text-orange-400">
                      {formatPrice(st.total_sales, true)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-850/60 pt-4 flex items-center justify-between text-xs text-slate-400">
                  <div className="grid grid-cols-2 gap-3">
                    <span>접수 주문 : </span>
                    <strong className="font-mono text-white font-bold">{st.total_orders}건</strong>
                    <span>고객 수 : </span>
                    <strong className="font-mono text-white font-bold">
                      {st.customer_count ?? '-'}명
                    </strong>
                    <span>저재고 : </span>
                    <strong
                      className={`font-mono font-bold ${st.low_stock_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                    >
                      {st.low_stock_count ?? 0}개
                    </strong>
                  </div>

                  <Link
                    to={`/admin/stores/${st.store_id}/orders`}
                    className="px-4 py-2 bg-white text-slate-950 rounded-xl font-black text-xs hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1 active:scale-95 shadow-md shadow-white/5"
                  >
                    <span>이 매장 대시보드로 입장</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

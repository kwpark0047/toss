import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { formatPrice } from '../../utils/format';
import api from '../../api/client';
import Icon from '../../components/ui/Icon';
import { CheckCircle2, DollarSign, MessageSquare, RefreshCw } from 'lucide-react';
export default function AlimtalkDeliveryConsole() {
  const {
    storeId
  } = useParams();
  const [data, setData] = useState({
    summary: {
      total: 0,
      success: 0,
      fallback: 0,
      total_cost: 0
    },
    logs: []
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [_socketStatus, _setSocketStatus] = useState('CONNECTED');
const fetchAlimtalkHistory = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await api.get(`/alimtalk/stores/${storeId}/history`);
      const json = res.data;
      setData(json.data || json || {
        summary: {
          total: 0,
          success: 0,
          fallback: 0,
          total_cost: 0
        },
        logs: []
      });
    } catch (err) {
      console.error('[Alimtalk] Fetch Error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [storeId]);
  useEffect(() => {
    if (storeId) {
      fetchAlimtalkHistory(true);
      const iv = setInterval(() => fetchAlimtalkHistory(false), 15000); // 15초마다 백그라운드 갱신
      return () => clearInterval(iv);
    }
  }, [storeId, fetchAlimtalkHistory]);
const summary = useMemo(() => data.summary || {
    total: 0,
    success: 0,
    fallback: 0,
    total_cost: 0
  }, [data]);
  const logs = useMemo(() => data.logs || [], [data]);

  // 전송 성공률 계산
  const successRate = useMemo(() => {
    if (!summary.total) return 100;
    return Math.round(summary.success / summary.total * 100);
  }, [summary.success, summary.total]);

  // 검색 필터링 적용
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(log => log.phone.includes(q) || log.templateId.toLowerCase().includes(q) || log.text.toLowerCase().includes(q));
  }, [logs, searchQuery]);
  return <div className="space-y-8 text-slate-100 max-w-7xl mx-auto p-1 select-none font-sans">
      
      {/* 1. 최상단 통합 헤더바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
              <Icon icon="MessageSquare" size="md" className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              알림톡 전송 콘솔
              <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Alimtalk & SMS Delivery Monitor
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            고객에게 발송되는 주문 접수, 조리 완료, 비상 상태 알림톡 전송 이력 및 전송 수수료 정산을 실시간 대조 모니터링합니다.
          </p>
        </div>

        {/* 상단 컨트롤 패널 */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-64">
            <input type="text" placeholder="수신 번호, 템플릿, 문구 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-10 py-2.5 text-xs focus:outline-none focus:border-orange-500 transition-all placeholder-slate-500" />
            <Icon icon="Search" size="md" className="size-4 text-slate-500 absolute left-3.5 top-3" />
          </div>
          <button onClick={() => fetchAlimtalkHistory(true)} disabled={loading} className="w-10 h-10 rounded-xl border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center bg-slate-950 active:scale-95">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. 최상단 3-Column 알림 정산 KPI 카드 모듈 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: 총 발송 수량 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">누적 알림 전송량</span>
            <MessageSquare className="text-orange-500" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {summary.total?.toLocaleString()} <span className="text-lg font-bold text-slate-400">건</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              알림톡 : {summary.success?.toLocaleString()}건 | SMS 대안 : {summary.fallback?.toLocaleString()}건
            </p>
          </div>
        </div>

        {/* KPI 2: 전송 성공률 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">알림 전송 도달 성공률</span>
            <CheckCircle2 className="text-blue-400" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {successRate} <span className="text-lg font-bold text-slate-400">%</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
              서버 통신 대역폭 보장 99.9% 무결 가동
            </p>
          </div>
        </div>

        {/* KPI 3: 누적 정산비용 */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.04),transparent_70%)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">누적 소모 수수료 (정산대상)</span>
            <DollarSign className="text-emerald-400" size={18} />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {formatPrice(summary.total_cost || 0, true)}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5">
              알림톡: ₩15/건 · SMS: ₩50/건 (SaaS 월간 합산 정산)
            </p>
          </div>
        </div>
      </div>

      {/* 3. 실시간 전송 로그 테이블 */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 space-y-4 shadow-2xl">
        <div className="space-y-0.5">
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <Icon icon="BarChart3" />
            실시간 알림톡 전송 로그 대사 레코드
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live Alimtalk Transmission History</p>
        </div>

        <div className="overflow-x-auto border border-slate-850/60 rounded-2xl bg-slate-950/40">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-850/60 text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-900/30">
                <th className="p-4">수신 전화번호</th>
                <th className="p-4">템플릿 식별자</th>
                <th className="p-4">송신 메시지 본문</th>
                <th className="p-4 text-center">채널 상태</th>
                <th className="p-4 text-right">정산 단가</th>
                <th className="p-4 text-right">송신 일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40 text-xs font-medium">
              {filteredLogs.length === 0 ? <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-600 font-semibold">
                    송신된 알림톡 전송 이력이 존재하지 않습니다.
                  </td>
                </tr> : filteredLogs.map(log => {
              const isSms = log.fallback || log.simulated === false && log.sent === false;
              const formattedPhone = log.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3');
              return <tr key={log.id || log.timestamp} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-200 tabular-nums">
                        {formattedPhone}
                      </td>
                      <td className="p-4 font-mono">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-slate-400 font-bold uppercase">
                          {log.templateId}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 max-w-xs truncate leading-relaxed" title={log.text}>
                        {log.text}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${log.simulated ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : isSms ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                          {log.simulated ? 'SIMULATED' : isSms ? 'FALLBACK_SMS' : 'ALIMTALK'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-300 tabular-nums">
                        {isSms ? '₩50' : '₩15'}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-500 tabular-nums">
                        {new Date(log.timestamp).toLocaleString('ko-KR', {
                    hour12: false
                  })}
                      </td>
                    </tr>;
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 쇼케이스 및 타 대시보드로 돌아가기 링크바 */}
      <footer className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>&copy; WeMarket Notification Display.</span>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/orders`} className="hover:text-slate-300 underline">
            주문 관리 대시보드
          </Link>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/foodtruck/analytics`} className="hover:text-slate-300 underline">
            지능형 피크분석 대시보드
          </Link>
        </div>
        <div className="font-mono">
          SYSTEM HEALTHY
        </div>
      </footer>
    </div>;
}

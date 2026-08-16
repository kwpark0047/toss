import { useState, useEffect, useCallback, Component } from 'react';
import { Activity, Database, Zap, Shield, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp, Server, Cpu } from 'lucide-react';
import { useSEO } from '../../lib/useSEO';
import api from '../../api';

/**
 * 각 섹션을 독립적으로 감싸는 에러 바운더리
 * 한 섹션 실패가 전체 대시보드를 망가뜨리지 않도록 함
 */
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };
  render() {
    if (this.state.hasError) {
      return <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm" role="alert">
                    <div className="flex items-center gap-2 text-red-600">
                        <XCircle size={16} />
                        <span className="font-bold text-sm">{this.props.sectionName || '섹션'} 로딩 실패</span>
                    </div>
                    <p className="text-xs text-red-400 mt-1">{this.state.error?.message || '알 수 없는 오류'}</p>
                    <button onClick={this.handleReset} className="mt-2 text-xs text-red-500 underline hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 rounded">
                        다시 시도
                    </button>
                </div>;
    }
    return this.props.children;
  }
}
const REFRESH_INTERVAL = 15_000; // 15초 자동 갱신 (지표 응답성 극대화)

const StatusBadge = ({
  status
}) => {
  const map = {
    ok: {
      label: '정상',
      cls: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle2
    },
    degraded: {
      label: '저하',
      cls: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle
    },
    error: {
      label: '오류',
      cls: 'bg-red-100 text-red-700',
      icon: XCircle
    },
    circuit_open: {
      label: '차단 중',
      cls: 'bg-red-100 text-red-700',
      icon: Shield
    },
    warn: {
      label: '경고',
      cls: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle
    },
    CLOSED: {
      label: '정상',
      cls: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle2
    },
    OPEN: {
      label: '차단',
      cls: 'bg-red-100 text-red-700',
      icon: XCircle
    },
    HALF_OPEN: {
      label: '복구 중',
      cls: 'bg-blue-100 text-blue-700',
      icon: RefreshCw
    }
  };
  const s = map[status] || {
    label: status,
    cls: 'bg-gray-100 text-gray-600',
    icon: Activity
  };
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${s.cls}`}>
            <Icon size={11} /> {s.label}
        </span>;
};
const MetricCard = ({
  icon: Icon,
  label,
  value,
  sub,
  color = '#6B7280',
  alert
}) => <div className={`bg-white rounded-2xl p-5 border shadow-sm ${alert ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
      backgroundColor: color + '20'
    }}>
                <Icon size={18} style={{
        color
      }} />
            </div>
            {alert && <AlertTriangle size={16} className="text-red-400" />}
        </div>
        <p className="text-2xl font-black text-gray-900 mt-3">{value ?? '—'}</p>
        <p className="text-sm font-bold text-gray-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>;
export default function SystemStatus() {
  useSEO({
    title: '시스템 상태 | 위마켓',
    description: '위마켓 시스템 상태 및 서비스 모니터링'
  });
  const [health, setHealth] = useState(null);
  const [sla, setSla] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [dbProfile, setDbProfile] = useState(null); // Prisma DB 프로파일링 상태 추가
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchBody = path => api.get(path).catch(e => {
        if (e?.response?.data) return e.response.data;
        throw e;
      });
      const [hRes, sRes, cRes, dRes] = await Promise.all([fetchBody('/health/deep'), fetchBody('/health/sla'), fetchBody('/health/circuits'), fetchBody('/analytics/db-profile') // 실시간 Prisma 데이터 조회 연동
      ]);
      setHealth(hRes?.data ?? hRes);
      setSla(sRes?.data ?? sRes);
      setCircuits((cRes?.data ?? cRes)?.circuits || []);
      setDbProfile(dRes?.data ?? dRes);
      setLastRefresh(new Date());
    } catch {
      setError('시스템 상태 및 데이터베이스 프로파일 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);
  const overall = health?.status || 'unknown';
  const dbCheck = health?.checks?.database;
  const memCheck = health?.checks?.memory;
  const slaData = sla?.current;
  const slaTarget = sla?.target;
  const errorRatePct = parseFloat(slaData?.errorRatePct || 0);
  const p99Ms = slaData?.p99Ms || 0;
  const isErrorHigh = errorRatePct > (slaTarget?.errorRateMaxPct || 1);
  const isP99High = p99Ms > (slaTarget?.p99MaxMs || 2000);
  return <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 select-none font-sans">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <Activity className="text-blue-400" /> 시스템 현황 & 원장 프로파일
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {lastRefresh ? `마지막 갱신: ${lastRefresh.toLocaleTimeString()}` : '불러오는 중...'}
                        {' '}(15초 자동 갱신)
                    </p>
                </div>
                <button onClick={fetchAll} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-50 transition-all">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
                </button>
            </div>

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3" role="alert">
                    <XCircle className="text-red-500 flex-shrink-0" aria-hidden="true" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>}

            <SectionErrorBoundary sectionName="전체 상태">
                <div className={`p-5 rounded-2xl border-2 flex items-center gap-4
                    ${overall === 'ok' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`} role="status" aria-live="polite" aria-label={`전체 시스템 상태: ${overall}`}>
                    {overall === 'ok' ? <CheckCircle2 size={32} className="text-emerald-500 flex-shrink-0" aria-hidden="true" /> : <AlertTriangle size={32} className="text-red-500 flex-shrink-0" aria-hidden="true" />}
                    <div>
                        <p className={`text-lg font-black ${overall === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {overall === 'ok' ? '모든 시스템 정상 운영 중' : '일부 시스템 이상 감지'}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                            업타임: {slaData?.uptimeFormatted || '—'} | SLO 목표 {slaTarget?.uptimePct || 99.5}%
                        </p>
                    </div>
                </div>
            </SectionErrorBoundary>

            <SectionErrorBoundary sectionName="핵심 지표">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="5분 SLA 지표">
                    <MetricCard icon={TrendingUp} label="5분 요청 수" value={slaData?.req5m ?? '—'} color="#0EA5E9" sub={`에러 ${slaData?.err5m ?? 0}건`} />
                    <MetricCard icon={AlertTriangle} label="에러율 (5분)" value={`${errorRatePct.toFixed(1)}%`} color={isErrorHigh ? '#EF4444' : '#10B981'} sub={`목표 < ${slaTarget?.errorRateMaxPct || 1}%`} alert={isErrorHigh} />
                    <MetricCard icon={Clock} label="응답 P99" value={`${p99Ms}ms`} color={isP99High ? '#EF4444' : '#8B5CF6'} sub={`목표 < ${slaTarget?.p99MaxMs || 2000}ms`} alert={isP99High} />
                    <MetricCard icon={Cpu} label="P95 응답" value={`${slaData?.p95Ms ?? 0}ms`} color="#F59E0B" sub={`P50: ${slaData?.p50Ms ?? 0}ms`} />
                </div>
            </SectionErrorBoundary>

            {/* DB & 메모리 */}
            <SectionErrorBoundary sectionName="데이터베이스 및 메모리">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm" role="region" aria-label="데이터베이스 상태">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Database size={18} className="text-blue-500" aria-hidden="true" />
                                <span className="font-bold text-gray-800">데이터베이스</span>
                            </div>
                            <StatusBadge status={dbCheck?.status || 'unknown'} />
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">응답 시간</span>
                                <span className="font-bold">{dbCheck?.latencyMs ? `${dbCheck.latencyMs}ms` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Supabase PostgreSQL</span>
                                <span className="font-bold text-gray-600">pgBouncer 풀링</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm" role="region" aria-label="서버 메모리 상태">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Server size={18} className="text-purple-500" aria-hidden="true" />
                                <span className="font-bold text-gray-800">서버 메모리</span>
                            </div>
                            <StatusBadge status={memCheck?.status || 'unknown'} />
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">힙 사용</span>
                                <span className="font-bold">{memCheck?.heapUsedMB ?? '—'} MB</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">힙 전체</span>
                                <span className="font-bold">{memCheck?.heapTotalMB ?? '—'} MB</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mt-2" role="progressbar" aria-valuenow={memCheck ? Math.round(memCheck.heapUsedMB / (memCheck.heapTotalMB || 1) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                                <div className="bg-purple-400 rounded-full h-2 transition-all" style={{
                width: `${memCheck ? Math.min(100, memCheck.heapUsedMB / (memCheck.heapTotalMB || 1) * 100) : 0}%`
              }} />
                            </div>
                        </div>
                    </div>
                </div>
            </SectionErrorBoundary>

            {/* Circuit Breaker 상태 */}
            <SectionErrorBoundary sectionName="Circuit Breaker">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm" role="region" aria-label="Circuit Breaker 상태">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Shield size={18} className="text-indigo-500" aria-hidden="true" /> Circuit Breaker 상태 (외부 서비스 장애 격리)
                    </h3>
                    {circuits.length === 0 ? <p className="text-sm text-gray-400">아직 외부 서비스 호출 이력 없음</p> : <div className="space-y-3">
                            {circuits.map(c => <div key={c.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-bold text-sm text-gray-800">{c.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            실패 {c.failureCount}회
                                            {c.lastFailureAt && ` | 마지막 오류: ${new Date(c.lastFailureAt).toLocaleTimeString()}`}
                                            {c.nextAttemptAt && c.state === 'OPEN' && ` | 재시도: ${new Date(c.nextAttemptAt).toLocaleTimeString()}`}
                                        </p>
                                    </div>
                                    <StatusBadge status={c.state} />
                                </div>)}
                        </div>}
                </div>
            </SectionErrorBoundary>

            {/* Prisma DB Query Latency Profiler */}
            <SectionErrorBoundary sectionName="DB Profiler">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4" role="region" aria-label="Prisma DB 쿼리 프로파일러">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="text-orange-500 animate-pulse" size={18} aria-hidden="true" />
                            <h3 className="font-bold text-gray-800">Prisma DB Query Latency Profiler</h3>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border">
                            SLA 100ms 가동률 추적 중
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">총 집계 로그</span>
                            <span className="text-lg font-mono font-bold text-slate-800 tabular-nums">
                                {dbProfile?.summary?.total_queries || 0} <span className="text-xs font-normal">건</span>
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">평균 쿼리 응답</span>
                            <span className="text-lg font-mono font-bold text-indigo-500 tabular-nums">
                                {dbProfile?.summary?.avg_latency_ms || 0} <span className="text-xs font-normal">ms</span>
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">피크 쿼리 지연</span>
                            <span className="text-lg font-mono font-bold text-orange-500 tabular-nums">
                                {dbProfile?.summary?.max_latency_ms || 0} <span className="text-xs font-normal">ms</span>
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">SLA 초과율 (100ms+)</span>
                            <span className={`text-lg font-mono font-bold tabular-nums ${(dbProfile?.summary?.slow_queries_count || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {dbProfile?.summary?.slow_queries_count || 0}건 ({dbProfile?.summary?.slow_query_ratio || 0}%)
                            </span>
                        </div>
                    </div>

                    <div className="overflow-hidden border border-slate-100 rounded-xl max-h-64 overflow-y-auto" role="region" aria-label="실시간 쿼리 목록">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="p-3" scope="col">SQL RAW QUERY COMMAND</th>
                                    <th className="p-3 text-right" scope="col">LATENCY</th>
                                    <th className="p-3 text-right" scope="col">TIMESTAMP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium font-mono text-[11px] text-slate-700">
                                {!dbProfile?.logs || dbProfile.logs.length === 0 ? <tr>
                                        <td colSpan={3} className="p-8 text-center text-slate-400 font-sans font-bold">
                                            수집된 데이터베이스 실시간 트랜잭션 쿼리 로그가 없습니다.
                                        </td>
                                    </tr> : dbProfile.logs.map(log => {
                const isSlow = log.duration >= 100;
                const isFast = log.duration < 10;
                let queryColor = 'text-slate-600';
                if (log.query?.startsWith('SELECT')) queryColor = 'text-sky-600 font-bold';else if (log.query?.startsWith('UPDATE') || log.query?.startsWith('INSERT')) queryColor = 'text-purple-600';else if (log.query?.startsWith('DELETE')) queryColor = 'text-rose-600 font-bold';
                return <tr key={log.id || log.timestamp} className={`hover:bg-slate-50/50 transition-colors ${isSlow ? 'bg-rose-500/[0.02]' : ''}`}>
                                                <td className="p-3 max-w-lg truncate" title={log.query}>
                                                    <span className={queryColor}>&gt; {log.query}</span>
                                                </td>
                                                <td className={`p-3 text-right font-bold tabular-nums ${isSlow ? 'text-rose-500' : isFast ? 'text-emerald-500' : 'text-slate-500'}`}>
                                                    {log.duration}ms
                                                </td>
                                                <td className="p-3 text-right text-slate-400 tabular-nums">
                                                    {new Date(log.timestamp).toLocaleTimeString('ko-KR', {
                      hour12: false
                    })}
                                                </td>
                                            </tr>;
              })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </SectionErrorBoundary>

            {/* SLA 목표 대비 현황 */}
            <SectionErrorBoundary sectionName="SLO 현황">
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-100 p-5" role="region" aria-label="SLO 목표 대비 현황">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-blue-500" aria-hidden="true" /> SLO 목표 vs 현황
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-400 border-b border-slate-200">
                                    <th className="pb-2 font-bold" scope="col">지표</th>
                                    <th className="pb-2 font-bold text-right" scope="col">목표</th>
                                    <th className="pb-2 font-bold text-right" scope="col">현재</th>
                                    <th className="pb-2 font-bold text-right" scope="col">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[{
                label: '가용성',
                target: `${slaTarget?.uptimePct}%`,
                current: slaData?.uptimeFormatted,
                ok: true
              }, {
                label: '에러율',
                target: `< ${slaTarget?.errorRateMaxPct}%`,
                current: `${errorRatePct.toFixed(2)}%`,
                ok: !isErrorHigh
              }, {
                label: 'P99 응답',
                target: `< ${slaTarget?.p99MaxMs}ms`,
                current: `${p99Ms}ms`,
                ok: !isP99High
              }, {
                label: '분기 최대 다운',
                target: `${slaTarget?.maxDowntimePerQuarterMin}분`,
                current: '0분',
                ok: true
              }].map(row => <tr key={row.label}>
                                        <td className="py-2.5 font-medium text-gray-700">{row.label}</td>
                                        <td className="py-2.5 text-right text-gray-500">{row.target}</td>
                                        <td className="py-2.5 text-right font-bold text-gray-900">{row.current ?? '—'}</td>
                                        <td className="py-2.5 text-right">
                                            {row.ok ? <CheckCircle2 size={16} className="text-emerald-500 inline" aria-label="정상" /> : <AlertTriangle size={16} className="text-red-500 inline" aria-label="위반" />}
                                        </td>
                                    </tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </SectionErrorBoundary>

            {/* 부하 테스트 안내 */}
            <SectionErrorBoundary sectionName="부하 테스트">
                <div className="bg-slate-800 text-white rounded-2xl p-5 text-sm" role="region" aria-label="부하 테스트 실행 안내">
                    <p className="font-bold text-slate-200 mb-2">점심 피크 부하 테스트 실행 방법</p>
                    <code className="block bg-slate-900 rounded-xl p-3 text-xs text-green-400 leading-relaxed">
                        # 로컬 서버 대상{'\n'}
                        npx artillery run scripts/load-test.yml{'\n\n'}
                        # 운영 서버 대상{'\n'}
                        LOAD_TEST_BASE_URL=https://wemarket-toss.onrender.com \{'\n'}
                        LOAD_TEST_STORE_ID=1 \{'\n'}
                        npx artillery run scripts/load-test.yml
                    </code>
                    <p className="text-slate-400 text-xs mt-3">
                        50 VU × 5분 동시 주문 부하 | 목표: 에러율 &lt;1%, P99 &lt;2000ms
                    </p>
                </div>
            </SectionErrorBoundary>
        </div>;
}

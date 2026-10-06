import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import api from '@/api/client';

export default function SystemStatusWidget() {
  const [status, setStatus] = useState({ network: navigator.onLine, health: 'checking', latency: null, checkedAt: null });
  const busy = useRef(false);
  const alive = useRef(false);
  const checkHealth = useCallback(async () => {
    if (busy.current || document.hidden) return;
    busy.current = true;
    const start = performance.now();
    try {
      const response = await api.get('/health', { timeout: 15000 });
      const data = response?.data ?? response;
      if (alive.current) setStatus({ network: navigator.onLine, health: data?.status === 'ok' && data?.db === 'connected' ? 'healthy' : 'error', latency: Math.round(performance.now() - start), checkedAt: new Date() });
    } catch {
      if (alive.current) setStatus({ network: navigator.onLine, health: 'error', latency: null, checkedAt: new Date() });
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    alive.current = true;
    const network = () => { setStatus(previous => ({ ...previous, network: navigator.onLine })); if (navigator.onLine) checkHealth(); };
    const visible = () => { if (!document.hidden) checkHealth(); };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    document.addEventListener('visibilitychange', visible);
    checkHealth();
    const timer = setInterval(checkHealth, 60000);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener('online', network); window.removeEventListener('offline', network); document.removeEventListener('visibilitychange', visible); };
  }, [checkHealth]);

  const healthy = status.network && status.health === 'healthy';
  const label = !status.network ? '인터넷 연결 끊김' : status.health === 'checking' ? '연결 확인 중' : healthy ? 'API · DB 정상' : '서버 연결 확인 필요';
  return <section aria-label="시스템 연결 상태" className="dashboard-health flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
    <div className="flex items-center gap-3"><Activity size={16} className="text-slate-400" /><span className="font-medium text-slate-300">시스템 상태</span><span role="status" className={`flex items-center gap-2 ${healthy ? 'text-emerald-500' : status.health === 'checking' ? 'text-slate-400' : 'text-amber-500'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span></div>
    <div className="flex items-center gap-3 text-slate-400"><span className="flex items-center gap-1.5">{status.network ? <Wifi size={14} /> : <WifiOff size={14} />}{status.network ? '온라인' : '오프라인'}</span>{status.latency !== null && <span className="font-mono tabular-nums">{status.latency}ms</span>}<span className="hidden sm:inline">{status.checkedAt ? `${status.checkedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 확인` : '확인 중'}</span><button onClick={checkHealth} aria-label="연결 상태 다시 확인" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"><RefreshCw size={14} /></button></div>
  </section>;
}
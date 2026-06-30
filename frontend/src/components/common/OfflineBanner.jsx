import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus, useConnectionInfo } from '@/hooks/usePWA';
import { useState, useEffect, useRef } from 'react';

export default function OfflineBanner() {
  const { isOnline, isVerified } = useOnlineStatus();
  const connInfo = useConnectionInfo();
  const [phase, setPhase] = useState('hidden'); // hidden | offline | restoring | restored
  const [retrying, setRetrying] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    if (!isOnline) {
      clearAll();
      setPhase('offline');
      setRestoreProgress(0);
      return;
    }

    if (phase === 'offline') {
      // Transition: offline → restoring → restored → hidden
      setPhase('restoring');
      // Animate progress bar 0 → 100 over 1.5 s
      let pct = 0;
      progressRef.current = setInterval(() => {
        pct = Math.min(pct + 4, 100);
        setRestoreProgress(pct);
        if (pct >= 100) {
          clearInterval(progressRef.current);
          setPhase('restored');
          timerRef.current = setTimeout(() => setPhase('hidden'), 2500);
        }
      }, 60);
    }
  }, [isOnline]);

  function clearAll() {
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
  }

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await fetch('/api/health', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    } catch (_) {}
    finally { setRetrying(false); }
  }

  if (phase === 'hidden') return null;

  const isOffline    = phase === 'offline';
  const isRestoring  = phase === 'restoring';
  const isRestored   = phase === 'restored';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        fixed top-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-out
        ${phase === 'hidden' ? '-translate-y-full' : 'translate-y-0'}
      `}
    >
      {/* Main banner */}
      <div className={`
        flex items-center gap-3 px-4 py-2.5 text-white text-sm font-semibold
        transition-colors duration-500
        ${isRestored ? 'bg-emerald-600' : isRestoring ? 'bg-emerald-700' : 'bg-red-600'}
      `}>

        {/* Icon */}
        <div className="flex-shrink-0">
          {isRestored || isRestoring ? (
            <Wifi size={16} className={isRestoring ? 'animate-pulse' : ''} />
          ) : (
            <WifiOff size={16} />
          )}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          {isRestored && <span>인터넷 연결이 복구되었습니다</span>}
          {isRestoring && <span>연결 복구 중...</span>}
          {isOffline && (
            <span className="flex items-center gap-2 flex-wrap">
              오프라인 상태
              {connInfo.type && (
                <span className="text-red-200 font-normal text-xs">
                  · {connInfo.type.toUpperCase()}
                </span>
              )}
              <span className="text-red-200 font-normal text-xs">
                — 일부 기능이 제한됩니다
              </span>
            </span>
          )}
        </div>

        {/* Retry button (offline only) */}
        {isOffline && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
            {retrying ? '확인 중' : '재시도'}
          </button>
        )}
      </div>

      {/* Progress bar (restoring phase) */}
      {isRestoring && (
        <div className="h-0.5 bg-emerald-800">
          <div
            className="h-full bg-emerald-400 transition-none"
            style={{ width: `${restoreProgress}%` }}
          />
        </div>
      )}

      {/* Degraded warning: navigator.onLine but API unreachable */}
      {isOnline && !isVerified && phase !== 'offline' && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold">
          <AlertTriangle size={13} />
          서버 응답이 느립니다 — 데이터가 최신 상태가 아닐 수 있습니다
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tablesAPI, wakeupServer } from '@/api';
import { Loader2, QrCode, AlertCircle, RefreshCw, Wifi } from 'lucide-react';

const MAX_RETRIES = 8;          // 최대 재시도
const RETRY_INTERVAL_MS = 3000; // 3초 간격

export default function QrResolvePage() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(!qrCode ? 'error' : 'wakeup'); // wakeup | resolving | error
  const [attempt, setAttempt] = useState(0);
  const retryCount = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!qrCode) return;

    const run = async () => {
      /* 1. Render 서버 웨이크업 */
      setStatus('wakeup');
      try { await wakeupServer(); } catch { /* ignore */ }

      /* 2. QR 코드 resolve (재시도 포함) */
      while (retryCount.current < MAX_RETRIES && !cancelled.current) {
        setStatus('resolving');
        setAttempt(retryCount.current + 1);

        try {
          const res = await tablesAPI.getByQrCode(qrCode);
          const table = res?.data || res;

          if (table?.store_id) {
            if (!cancelled.current) {
              const tableParam = encodeURIComponent(table.table_number || table.name || '');
              navigate(`/menu/${table.store_id}?table=${tableParam}`, { replace: true });
            }
            return;
          }
        } catch {
          /* 서버 아직 준비 중 — 재시도 */
        }

        retryCount.current += 1;

        if (retryCount.current < MAX_RETRIES && !cancelled.current) {
          await new Promise(r => setTimeout(r, RETRY_INTERVAL_MS));
        }
      }

      if (!cancelled.current) setStatus('error');
    };

    run();
    return () => { cancelled.current = true; };
  }, [qrCode, navigate]);

  /* ── 에러 화면 ── */
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center space-y-5 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg mb-2">메뉴판을 불러올 수 없습니다</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              잠시 후 다시 시도하거나 매장 직원에게 문의해주세요.
            </p>
          </div>
          <button
            onClick={() => { cancelled.current = false; retryCount.current = 0; setStatus('wakeup'); }}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw size={16} /> 다시 시도
          </button>
        </div>
      </div>
    );
  }

  /* ── 로딩 화면 ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="text-center space-y-6 max-w-xs w-full">
        {/* 로고 */}
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
          <QrCode size={28} className="text-orange-400" />
        </div>

        {/* 상태 메시지 */}
        <div>
          <h2 className="text-white font-black text-lg mb-2">
            {status === 'wakeup' ? '서버 연결 중...' : '메뉴판 불러오는 중...'}
          </h2>
          <p className="text-slate-500 text-sm">
            {status === 'wakeup'
              ? '처음 접속 시 서버를 깨우는 데 잠시 걸릴 수 있습니다.'
              : `연결 시도 중 (${attempt}/${MAX_RETRIES})`}
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((attempt / MAX_RETRIES) * 100, 90)}%` }}
          />
        </div>

        {/* 스피너 */}
        <div className="flex items-center justify-center gap-3 text-slate-500">
          {status === 'wakeup'
            ? <Wifi size={18} className="text-orange-400 animate-pulse" />
            : <Loader2 size={18} className="animate-spin text-orange-400" />}
          <span className="text-xs font-medium">
            {status === 'wakeup' ? 'WeMarket 서버 준비 중' : '주문 메뉴판 연결 중'}
          </span>
        </div>

        <p className="text-slate-600 text-xs">
          처음 접속 시 최대 30초 소요될 수 있습니다
        </p>
      </div>
    </div>
  );
}

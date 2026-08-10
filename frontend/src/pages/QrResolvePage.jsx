import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { tablesAPI, wakeupServer } from '@/api';
import { Loader2, QrCode, AlertCircle, RefreshCw, Wifi, Server } from 'lucide-react';
import { useSystemDark } from '@/hooks/useSystemDark';

const MAX_WAIT_MS = 60000;      // 총 대기 시간 (wakeupServer와 동일 60초)
const BASE_RETRY_MS = 2000;     // 초기 재시도 간격
const MAX_RETRY_MS = 8000;      // 최대 재시도 간격

export default function QrResolvePage() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const isDark = useSystemDark();
  const [status, setStatus] = useState(!qrCode ? 'error' : 'wakeup'); // wakeup | resolving | error
  const [attempt, setAttempt] = useState(0);
  const [serverReady, setServerReady] = useState(false);
  const startTime = useRef(Date.now());
  const retryCount = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!qrCode) return;

    const run = async () => {
      /* 1. Render 서버 웨이크업 */
      setStatus('wakeup');
      try {
        await wakeupServer();
        if (!cancelled.current) setServerReady(true);
      } catch { /* ignore */ }

      /* 2. QR 코드 resolve (지수 백오프 재시도) */
      let retryMs = BASE_RETRY_MS;
      while (Date.now() - startTime.current < MAX_WAIT_MS && !cancelled.current) {
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

        if (Date.now() - startTime.current < MAX_WAIT_MS && !cancelled.current) {
          await new Promise(r => setTimeout(r, retryMs));
          retryMs = Math.min(retryMs * 1.5, MAX_RETRY_MS); // 지수 백오프
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
      <div className={`min-h-screen flex items-center justify-center cust-bg-base px-6 ${isDark ? 'dark' : ''}`}>
        <div className="text-center space-y-5 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-rose-400" />
          </div>
          <div>
            <h2 className="cust-text-main font-black text-lg mb-2">메뉴판을 불러올 수 없습니다</h2>
            <p className="cust-text-sub text-sm leading-relaxed">
              서버가 준비되는 데 시간이 더 필요할 수 있습니다.
              <br />잠시 후 다시 시도하거나 매장 직원에게 문의해주세요.
            </p>
          </div>
          <button
            onClick={() => { cancelled.current = false; retryCount.current = 0; startTime.current = Date.now(); setStatus('wakeup'); setServerReady(false); }}
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
    <div className={`min-h-screen flex items-center justify-center cust-bg-base px-6 ${isDark ? 'dark' : ''}`}>
      <div className="text-center space-y-6 max-w-xs w-full">
        {/* 로고 */}
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
          <QrCode size={28} className="text-orange-400" />
        </div>

        {/* 상태 메시지 */}
        <div>
          <h2 className="cust-text-main font-black text-lg mb-2">
            {status === 'wakeup' ? '서버 연결 중...' : '메뉴판 불러오는 중...'}
          </h2>
          <p className="cust-text-sub text-sm">
            {status === 'wakeup'
              ? '처음 접속 시 서버를 깨우는 데 잠시 걸릴 수 있습니다.'
              : serverReady
                ? '서버 준비 완료 — 메뉴판 연결 중...'
                : '서버 준비 중... 잠시만 기다려주세요'}
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full cust-border rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(((Date.now() - startTime.current) / MAX_WAIT_MS) * 100, 95)}%` }}
          />
        </div>

        {/* 스피너 */}
        <div className="flex items-center justify-center gap-3 cust-text-sub">
          {status === 'wakeup'
            ? <Wifi size={18} className="text-orange-400 animate-pulse" />
            : <Loader2 size={18} className="animate-spin text-orange-400" />}
          <span className="text-xs font-medium">
            {status === 'wakeup' ? 'WeMarket 서버 준비 중' : '주문 메뉴판 연결 중'}
          </span>
        </div>

        <p className="cust-text-sub text-xs">
          처음 접속 시 최대 1분 소요될 수 있습니다
        </p>
      </div>
    </div>
  );
}

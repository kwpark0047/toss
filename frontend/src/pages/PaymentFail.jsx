import { useSearchParams, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function PaymentFail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = searchParams.get('code') || 'PAYMENT_FAILED';
  const message = searchParams.get('message') || '결제 진행 중 오류가 발생했습니다.';
  const paymentId = searchParams.get('payment_id');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* 장식용 글로우 배경 */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />

        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center animate-pulse">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-100">결제에 실패하였습니다</h1>
              <p className="text-xs text-slate-400">결제 요청 처리 중 다음과 같은 오류가 발생하였습니다.</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Error Code</span>
              <p className="text-xs font-mono font-bold text-red-400 bg-red-500/5 px-2 py-1 rounded border border-red-500/10 w-fit">
                {code}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Reason</span>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold">{message}</p>
            </div>
            {paymentId && (
              <div className="space-y-1 pt-1 border-t border-slate-800/40">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Transaction ID</span>
                <p className="text-xs text-slate-400 font-mono select-all">{paymentId}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={() => window.history.back()}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              결제 다시 시도하기
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              <Home className="w-4 h-4" />
              메인 화면으로
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
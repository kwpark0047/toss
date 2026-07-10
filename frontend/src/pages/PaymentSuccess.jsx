import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { paymentsAPI } from '../api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmTriggered = useRef(false);

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentData, setPaymentResult] = useState(null);

  // 파라미터 파싱
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId'); // Toss order_number
  const amount = searchParams.get('amount');
  const paymentId = searchParams.get('payment_id');
  const phone = searchParams.get('phone');
  const tossUserKey = searchParams.get('tossUserKey');

  useEffect(() => {
    // 마운트 시 단 한 번만 최종 승인(Capture)을 실행하도록 보증 (Idempotency Guard)
    if (confirmTriggered.current) return;
    confirmTriggered.current = true;

    if (!paymentKey || !orderId || !paymentId) {
      setStatus('error');
      setErrorMsg('유효하지 않은 결제 정보이거나 필수 정보가 누락되었습니다.');
      return;
    }

    const capturePayment = async () => {
      try {
        const { data } = await paymentsAPI.confirm(paymentId, {
          toss_payment_key: paymentKey,
          toss_transaction_id: orderId, // order_number
          toss_user_key: tossUserKey || undefined,
          phone: phone || undefined
        });

        if (data && data.success) {
          setPaymentResult(data);
          setStatus('success');
        } else {
          throw new Error(data?.message || '결제 최종 승인에 실패했습니다.');
        }
      } catch (err) {
        console.error('[PaymentSuccess] Capture Error:', err);
        setStatus('error');
        setErrorMsg(err.response?.data?.error || err.message || '최종 결제 승인 중 오류가 발생했습니다.');
      }
    };

    capturePayment();
  }, [paymentKey, orderId, paymentId, phone, tossUserKey]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* 장식용 글로우 배경 */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-orange-500/20 rounded-full" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold text-slate-200">결제 승인 중</h2>
              <p className="text-xs text-slate-400">토스페이먼츠 보안 게이트웨이에서 최종 승인을 처리하고 있습니다.</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-slate-100">결제가 완료되었습니다!</h1>
                <p className="text-xs text-slate-400">주문이 성공적으로 접수되어 주방으로 전송되었습니다.</p>
              </div>
            </div>

            <div className="border-t border-b border-slate-800/60 py-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">주문 번호</span>
                <span className="font-mono text-slate-200 font-semibold">{orderId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">결제 금액</span>
                <span className="text-orange-400 font-bold font-mono">
                  {Number(amount).toLocaleString()}원
                </span>
              </div>
              {paymentData?.pointsEarned > 0 && (
                <div className="flex justify-between text-xs bg-orange-500/5 border border-orange-500/10 p-2 rounded-lg">
                  <span className="text-orange-300 font-medium">적립된 포인트</span>
                  <span className="text-orange-400 font-bold font-mono">+{paymentData.pointsEarned.toLocaleString()} P</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => navigate(`/menu/${paymentData?.order?.store_id || ''}`)}
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                추가 주문하기
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                메인 화면으로
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-extrabold text-lg">!</div>
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-slate-100">결제 최종 승인 실패</h1>
                <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800/60 pt-4">
              <button
                onClick={() => window.history.back()}
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center"
              >
                이전 화면으로 돌아가기
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold rounded-xl text-sm transition-all flex items-center justify-center border border-slate-700"
              >
                메인으로 이동
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
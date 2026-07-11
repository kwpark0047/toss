import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Sparkles, ShoppingBag, ArrowRight, Share2, PlusSquare } from 'lucide-react';
import { paymentsAPI } from '../api';
import { toast } from 'react-toastify';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmTriggered = useRef(false);

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentData, setPaymentResult] = useState(null);

  // PWA 설치용 상태 관리
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isiOS, setIsiOS] = useState(false);

  // 파라미터 파싱
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId'); // Toss order_number
  const amount = searchParams.get('amount');
  const paymentId = searchParams.get('payment_id');
  const phone = searchParams.get('phone');
  const tossUserKey = searchParams.get('tossUserKey');

  // PWA beforeinstallprompt 감지 및 기기 체크
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS 기기 여부 검증
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent);
    setIsiOS(isApple);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

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

  // 원클릭 PWA 설치 실행 핸들러
  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('위마켓 앱이 홈 화면에 추가되고 있습니다! 🎉');
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6">
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

            {/* PWA 상용 앱 설치 제안 카드 (미설치 고객 온보딩 최적화 배너) */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                  <Sparkles className="size-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">WeMarket 고객 전용 앱 추가</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Zero-Friction PWA Install</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-sans font-semibold">
                홈 화면에 앱을 추가하면 알림톡 없이도 <strong>실시간 조리/호출 푸시 알림</strong>을 받을 수 있고, 번거로운 인증 없이 <strong>내 대기순서 및 포인트 적립 내역</strong>을 1초 만에 바로 조회할 수 있습니다!
              </p>

              {deferredPrompt ? (
                /* 크롬 / 안드로이드 표준 PWA 프로그래매틱 설치 단추 (48px 터치 타겟) */
                <button
                  onClick={handleInstallPwa}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 animate-bounce"
                >
                  <Sparkles className="w-4 h-4" />
                  위마켓 앱 홈 화면에 1초 추가
                </button>
              ) : isiOS ? (
                /* iOS Safari 수동 설치 가이드 발룬 */
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2 text-[10px] text-slate-300 font-medium leading-relaxed">
                  <p className="text-orange-400 font-bold flex items-center gap-1.5">
                    <PlusSquare size={13} />
                    아이폰(Safari) 원클릭 홈 화면 추가 가이드
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-400 font-semibold">
                    <li>Safari 브라우저 하단의 <strong className="text-white">공유 (Share)</strong> 버튼 클릭</li>
                    <li>목록을 아래로 스크롤하여 <strong className="text-white">'홈 화면에 추가'</strong> 버튼 클릭</li>
                    <li>우측 상단의 <strong className="text-white">'추가'</strong>를 누르면 설치가 완료됩니다!</li>
                  </ol>
                </div>
              ) : (
                /* 일반 기기용 설치 안내 플레이스홀더 */
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-slate-500 text-center font-bold leading-normal">
                  이미 앱이 설치되었거나 앱 구동 중입니다.<br />
                  홈 화면의 아이콘을 이용하면 실시간 픽업 조회가 가능합니다.
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

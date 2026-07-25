import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Sparkles, ShoppingBag, ArrowRight, Bell, Smartphone, Share, Info } from 'lucide-react';
import { paymentsAPI } from '../api';
import { requestNotificationPermission } from '../firebase';
import { toast } from 'react-toastify';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmTriggered = useRef(false);

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentData, setPaymentResult] = useState(null);

  // PWA 앱 설치 프로모션용 상태
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isSafari, setIsSafari] = useState(false);

  // 실시간 웹 푸시 온보딩용 상태
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushOnboarded, setPushOnboarded] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // 파라미터 파싱
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId'); // Toss order_number
  const amount = searchParams.get('amount');
  const paymentId = searchParams.get('payment_id');
  const phone = searchParams.get('phone');
  const tossUserKey = searchParams.get('tossUserKey');

  useEffect(() => {
    // 1. PWA 설치 브라우저 이벤트 감지 리스너 등록
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. 아이폰 Safari 환경 여부 판별 (Safari 전용 수동 홈화면 추가 팝업 가이드용)
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafariUA = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIOS && isSafariUA) {
      setIsSafari(true);
    }

    // 3. 브라우저 실시간 알림 권한 상태 판별 (온보딩 프롬프트 노출용)
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPushPrompt(true);
    }

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

  // PWA 원클릭 브라우저 전용 설치 트리거
  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('위마켓 전용 모바일 앱이 성공적으로 추가되고 있습니다!');
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error('[PWA Install] Trigger failed:', err);
    }
  };

  // 실시간 웹 푸시 온보딩 토큰 갱신 등록
  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        const res = await fetch(`/api/orders/${paymentData?.order?.id || paymentId}/customer-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          setPushOnboarded(true);
          toast.success('실시간 주문 알림 푸시가 성공적으로 수신 활성화되었습니다! 🔔');
        } else {
          throw new Error('토큰 연동에 실패했습니다.');
        }
      } else {
        toast.warn('알림 권한이 거부되었습니다. 주소창 왼쪽 설정을 눌러 알림을 다시 허용해 주세요.');
      }
    } catch (err) {
      console.error('[Push Onboarding] Error:', err);
      toast.error('푸시 알림 온보딩 중 오류가 발생했습니다.');
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
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
                <div className="flex justify-between text-xs bg-orange-500/5 border border-orange-500/10 p-2.5 rounded-xl">
                  <span className="text-orange-300 font-medium">적립된 포인트</span>
                  <span className="text-orange-400 font-bold font-mono">+{paymentData.pointsEarned.toLocaleString()} P</span>
                </div>
              )}
            </div>

            {/* 실시간 픽업/취소 알림 웹 푸시 온보딩 프로모션 카드 */}
            {showPushPrompt && !pushOnboarded && (
              <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h4 className="text-xs font-black text-indigo-300">실시간 주문 & 취소 알림 받기</h4>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1 font-semibold">
                      주방에서 음식을 완성해 호출하거나 비상 취소 상황 발생 시 브라우저 푸시 알림을 즉시 수신합니다.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleEnablePush}
                  disabled={pushLoading}
                  className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10"
                >
                  {pushLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>알림 활성화 중...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>실시간 알림(웹 푸시) 켜기</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 고객 맞춤형 홈 화면 PWA 전용 설치 카드 */}
            <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 shadow-md">
                  <Smartphone className="size-5" />
                </div>
                <div className="text-left space-y-1">
                  <h4 className="text-xs font-black text-white">WeMarket 고객용 전용 웹앱 설치</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    바탕화면에 전용 웹앱을 추가하면 주문 내역 및 포인트 적립 장부를 1초 자동 로그인으로 실시간 편하게 모니터링할 수 있습니다.
                  </p>
                </div>
              </div>

              {deferredPrompt ? (
                /* 원클릭 PWA 설치 버튼 지원 브라우저 (크롬, 안드로이드 등) */
                <button
                  onClick={handlePwaInstall}
                  className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/10 animate-pulse"
                >
                  <Smartphone className="size-4" />
                  <span>위마켓 원클릭 앱 설치 (추천)</span>
                </button>
              ) : isSafari ? (
                /* 아이폰 Safari용 브라우저 수동 홈화면 추가 벌룬 가이드 */
                <div className="bg-slate-950 border border-white/5 p-4 rounded-xl text-left space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold">
                    <Info size={13} />
                    <span>아이폰 iOS 설치 가이드</span>
                  </div>
                  <ol className="text-[10px] text-slate-400 space-y-1.5 list-decimal pl-4 leading-normal font-semibold">
                    <li>하단 내비게이션 바의 <Share className="size-3 inline mx-0.5 text-blue-400" /> <strong>공유</strong> 버튼을 탭합니다.</li>
                    <li>목록 아래로 내려서 <strong>'홈 화면에 추가'</strong> 버튼을 클릭합니다.</li>
                    <li>우측 상단 <strong>'추가'</strong>를 선택하여 위앱을 바탕화면에 안착시킵니다.</li>
                  </ol>
                </div>
              ) : (
                /* 미지원 브라우저 혜택 요약 캡션 */
                <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500 font-semibold text-left">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0" />
                  <span>이미 설치되었거나 브라우저 홈 화면에 추가를 제공하지 않는 환경입니다.</span>
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

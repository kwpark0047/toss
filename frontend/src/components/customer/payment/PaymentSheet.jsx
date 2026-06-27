import { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, Star, Building2, Banknote, ChevronRight, Check, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePoints } from '../../../hooks/usePoints';
import { useTossPayment } from '../../../hooks/useTossPayment';
import { paymentsAPI, storeAccountAPI } from '../../../api';
import { useBrandPay } from '../../../hooks/useBrandPay';
import PointPayment from './PointPayment';
import TransferPayment from './TransferPayment';
import { formatPrice } from '../../../utils/format';

// 결제 방법 메타데이터 (컴포넌트 내에서 useMemo로 다국어 처리 예정)
const PAYMENT_METHODS_META = [
  { id: 'brandpay', key: 'payment.brandpay', descKey: 'payment.brandpay_desc', icon: CreditCard, color: '#0064FF' },
  { id: 'toss_pay', key: 'payment.toss_pay', descKey: 'payment.toss_desc', icon: CreditCard, color: '#4E5968' },
  { id: 'point', key: 'payment.point', descKey: 'payment.point_desc', icon: Star, color: '#F59E0B' },
  { id: 'transfer', key: 'payment.transfer', descKey: 'payment.transfer_desc', icon: Building2, color: '#10B981' },
  { id: 'cash', key: 'payment.cash', descKey: 'payment.cash_desc', icon: Banknote, color: '#6B7280' }
];

export default function PaymentSheet({
  isOpen,
  onClose,
  store,
  cart = [],
  totalAmount,
  onPaymentComplete,
  userIdentifier = {} // { toss_user_key, phone }
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState('method'); // method, point, transfer, processing, result
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [storeAccount, setStoreAccount] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  const paymentMethods = useMemo(() => PAYMENT_METHODS_META.map(m => ({
    ...m,
    label: t(m.key),
    desc: t(m.descKey)
  })), [t]);

  const { points, calculateUsablePoints, calculateEarnPoints } = usePoints(userIdentifier);
  const { initiateTossPayment, loading: tossPaymentLoading } = useTossPayment();
  const { requestPayment: initiateBrandPay, loading: brandPayLoading } = useBrandPay();

  const [paymentLoading, setPaymentLoading] = useState(false);
  const createPayment = async (...args) => {
    setPaymentLoading(true);
    try {
      return await paymentsAPI.create(...args);
    } finally {
      setPaymentLoading(false);
    }
  };

  const [usablePoints, setUsablePoints] = useState(0);
  const [earnPoints, setEarnPoints] = useState(0);

  // 사용 가능 포인트 및 적립 예정 포인트 계산
  useEffect(() => {
    if (store?.id && totalAmount > 0) {
      calculateUsablePoints(totalAmount, store.id).then(data => {
        setUsablePoints(data?.usable_points || 0);
      });
      calculateEarnPoints(totalAmount, store.id).then(points => {
        setEarnPoints(points || 0);
      });
    }
  }, [store?.id, totalAmount, calculateUsablePoints, calculateEarnPoints]);

  // 매장 계좌 정보 조회
  useEffect(() => {
    if (store?.id && selectedMethod === 'transfer') {
      storeAccountAPI.get(store.id).then(res => {
        setStoreAccount(res.data);
      }).catch(() => setStoreAccount(null));
    }
  }, [store?.id, selectedMethod]);

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    if (methodId === 'point') {
      setStep('point');
    } else if (methodId === 'transfer') {
      setStep('transfer');
    } else {
      handlePayment(methodId);
    }
  };

  const handlePayment = async (method, customPointAmount = 0) => {
    setStep('processing');

    try {
      if (method === 'brandpay') {
        const result = await initiateBrandPay({
          orderId: `BP_${Date.now()}`,
          orderName: cart.length > 1 ? `${cart[0].product_name} 외 ${cart.length - 1}건` : cart[0].product_name,
          amount: totalAmount - customPointAmount
        });

        if (result.success) {
          setPaymentResult({
            success: true,
            method: 'brandpay',
            payment: result.payment,
            earnPoints
          });
          setStep('result');
        } else {
          throw new Error(result.error);
        }
      } else if (method === 'toss_pay') {
        // 토스페이 결제
        const result = await initiateTossPayment({
          orderId: null, // 주문 ID는 백엔드에서 생성
          storeId: store.id,
          totalAmount,
          pointAmount: customPointAmount,
          tossUserKey: userIdentifier.toss_user_key,
          phone: userIdentifier.phone
        });

        if (result.success) {
          setPaymentResult({
            success: true,
            method: 'toss_pay',
            payment: result.payment,
            earnPoints
          });
          setStep('result');
        } else {
          throw new Error(result.error);
        }
      } else if (method === 'point') {
        // 포인트 결제
        const res = await createPayment({
          store_id: store.id,
          payment_method: customPointAmount === totalAmount ? 'point' : 'mixed',
          total_amount: totalAmount,
          point_amount: customPointAmount,
          toss_user_key: userIdentifier.toss_user_key,
          phone: userIdentifier.phone,
          items: cart
        });

        setPaymentResult({
          success: true,
          method: 'point',
          payment: res.data,
          pointsUsed: customPointAmount,
          earnPoints
        });
        setStep('result');
      } else if (method === 'cash') {
        // 현금 결제
        const res = await createPayment({
          store_id: store.id,
          payment_method: 'cash',
          total_amount: totalAmount,
          point_amount: 0,
          toss_user_key: userIdentifier.toss_user_key,
          phone: userIdentifier.phone,
          items: cart
        });

        setPaymentResult({
          success: true,
          method: 'cash',
          payment: res.data,
          earnPoints
        });
        setStep('result');
      }
    } catch (error) {
      setPaymentResult({
        success: false,
        error: error.message || t('payment.failed')
      });
      setStep('result');
    }
  };

  const handleTransferComplete = (payment) => {
    setPaymentResult({
      success: true,
      method: 'transfer',
      payment,
      message: t('payment.transfer_notices.check_counter')
    });
    setStep('result');
  };

  const handlePointPayment = (amount) => {
    if (amount === totalAmount) {
      // 전액 포인트 결제
      handlePayment('point', amount);
    } else if (amount > 0) {
      // 혼합 결제 - 나머지는 토스페이로
      setSelectedMethod('mixed');
      handlePayment('toss_pay', amount);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">
            {step === 'method' && t('payment.select_method_title')}
            {step === 'point' && t('payment.point_usage_title')}
            {step === 'transfer' && t('payment.transfer')}
            {step === 'processing' && t('payment.processing')}
            {step === 'result' && t('payment.completed')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>

          {/* 결제 방법 선택 */}
          {step === 'method' && (
            <div className="space-y-3">
              {/* 총 결제 금액 */}
              <div className="p-4 bg-gray-50 rounded-xl mb-4">
                <div className="text-sm text-gray-500">{t('payment.total_amount')}</div>
                <div className="text-2xl font-bold">{formatPrice(totalAmount, true)}</div>
                {earnPoints > 0 && (
                  <div className="text-sm text-orange-500 mt-1">
                    {t('payment.earn_points_msg', { count: earnPoints })}
                  </div>
                )}
              </div>

              {/* 보유 포인트 표시 */}
              {points?.total_points > 0 && (
                <div className="p-3 bg-yellow-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm">{t('payment.holding_points')}</span>
                  </div>
                  <span className="font-bold text-yellow-600">
                    {points.total_points.toLocaleString()}P
                  </span>
                </div>
              )}

              {/* 결제 방법 목록 */}
              {paymentMethods.map(method => {
                const Icon = method.icon;
                const disabled = method.id === 'point' && usablePoints === 0;

                return (
                  <button
                    key={method.id}
                    onClick={() => !disabled && handleMethodSelect(method.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all
                      ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-blue-500 hover:bg-blue-50'}`}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: method.color + '20' }}
                    >
                      <Icon className="w-6 h-6" style={{ color: method.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{method.label}</div>
                      <div className="text-sm text-gray-500">
                        {method.id === 'point' && usablePoints > 0
                          ? t('payment.max_usable_points', { count: usablePoints.toLocaleString() })
                          : method.desc}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                );
              })}
            </div>
          )}

          {/* 포인트 결제 */}
          {step === 'point' && (
            <PointPayment
              totalAmount={totalAmount}
              availablePoints={points?.total_points || 0}
              usablePoints={usablePoints}
              onConfirm={handlePointPayment}
              onBack={() => setStep('method')}
            />
          )}

          {/* 계좌이체 */}
          {step === 'transfer' && (
            <TransferPayment
              storeAccount={storeAccount}
              totalAmount={totalAmount}
              storeId={store?.id}
              userIdentifier={userIdentifier}
              onComplete={handleTransferComplete}
              onBack={() => setStep('method')}
            />
          )}

          {/* 결제 진행 중 */}
          {(paymentLoading || tossPaymentLoading || brandPayLoading) && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              <p className="mt-4 text-gray-600">{t('payment.processing')}...</p>
            </div>
          )}

          {step !== 'processing' && step === 'result' && paymentResult && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              <p className="mt-4 text-gray-600">{t('payment.processing')}...</p>
            </div>
          )}

          {/* 결제 결과 화면 고도화 */}
          {step === 'result' && paymentResult && (
            <div className="py-8 text-center animate-in fade-in zoom-in duration-300">
              {paymentResult.success ? (
                <>
                  <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{t('payment.success_msg')}</h3>
                  <p className="mt-2 text-gray-500 px-6 leading-relaxed">
                    {paymentResult.message || t('payment.order_thanks')}
                  </p>

                  {/* 적립 포인트 박스 */}
                  {paymentResult.earnPoints > 0 && (
                    <div className="mt-6 p-4 bg-orange-50 rounded-2xl inline-flex flex-col items-center border border-orange-100">
                      <span className="text-orange-600 font-bold text-lg">
                        {t('payment.points_earned', { count: paymentResult.earnPoints.toLocaleString() })}
                      </span>
                      <span className="text-orange-400 text-xs mt-1">{t('payment.benefit_label')}</span>
                    </div>
                  )}

                  {/* 영수증/상세 버튼 영역 */}
                  <div className="mt-8 flex flex-col gap-3 px-4">
                    {paymentResult.payment?.receipt_url && (
                      <button
                        onClick={() => window.open(paymentResult.payment.receipt_url, '_blank')}
                        className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
                      >
                        <ExternalLink className="w-5 h-5" /> {t('payment.view_receipt')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onPaymentComplete?.(paymentResult);
                        onClose();
                      }}
                      className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 active:scale-95 transition-all text-lg"
                    >
                      {t('payment.wait_focus')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <X className="w-10 h-10 text-red-500" strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-bold text-red-600">{t('payment.failed')}</h3>
                  <p className="mt-2 text-gray-500 px-6">{paymentResult.error}</p>

                  <div className="mt-8 px-4">
                    <button
                      onClick={() => setStep('method')}
                      className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-all"
                    >
                      {t('payment.retry_other')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

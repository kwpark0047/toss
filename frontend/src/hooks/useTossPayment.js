import { useState, useCallback } from 'react';
import { paymentsAPI } from '../api';

// 토스 앱 환경 체크
const isTossApp = () => {
  return typeof window !== 'undefined' && window.TossApp !== undefined;
};

export function useTossPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // 토스페이 결제 실행
  const initiateTossPayment = useCallback(async ({
    orderId,
    storeId,
    totalAmount,
    pointAmount = 0,
    tossUserKey,
    phone
  }) => {
    setLoading(true);
    setError(null);
    setPaymentResult(null);

    try {
      // 0. 포인트 전액 결제 체크
      if (totalAmount <= 0 && pointAmount > 0) {
        // 토스페이를 거치지 않고 서버에서 포인트 결제로 즉시 처리
        const { data: pointResult } = await paymentsAPI.confirm('point_only', {
          order_id: orderId,
          amount: 0,
          point_amount: pointAmount,
          toss_user_key: tossUserKey,
          phone
        });

        setPaymentResult({ success: true, payment: pointResult.payment });
        return { success: true, payment: pointResult.payment };
      }

      // 1. 서버에서 결제 준비 (Ready)
      const { data: payment } = await paymentsAPI.create({
        order_id: orderId,
        store_id: storeId,
        payment_method: 'toss_pay',
        total_amount: totalAmount,
        point_amount: pointAmount,
        toss_user_key: tossUserKey,
        phone
      });

      // 2. 토스 앱 SDK 호출 (Web Bridge)
      if (isTossApp() && payment.pay_token) {
        try {
          const { checkoutPayment } = await import('@apps-in-toss/web-bridge');

          // 사용자가 결제창을 닫거나 취소하는 경우 대비
          const result = await checkoutPayment({
            payToken: payment.pay_token
          });

          if (result.status === 'success') {
            // 3. 결제 성공 - 서버에 최종 승인 요청 (Capture)
            const { data: confirmed } = await paymentsAPI.confirm(payment.payment_id, {
              toss_payment_key: result.paymentKey,
              toss_transaction_id: result.transactionId,
              toss_user_key: tossUserKey,
              phone
            });

            setPaymentResult({
              success: true,
              payment: confirmed.payment,
              pointsEarned: confirmed.points_earned
            });

            return { success: true, ...confirmed };
          } else {
            // 사용자가 결제를 취소함
            throw new Error('결제가 중단되었습니다.');
          }
        } catch (tossError) {
          // 결제 과정 중 에러 발생 시 서버에 취소 알림
          await paymentsAPI.cancel(payment.payment_id, {
            reason: tossError.message || '사용자 취소',
            toss_user_key: tossUserKey
          });
          throw tossError;
        }
      } else {
        // [테스트 모드] 토스 앱이 아니거나 토큰이 없는 경우 시뮬레이션
        console.warn('토스 앱 환경이 아님: 테스트 결제로 진행합니다.');
        const { data: testResult } = await paymentsAPI.confirm(payment.payment_id, {
          toss_payment_key: `T_TEST_${Date.now()}`,
          toss_user_key: tossUserKey,
          phone
        });

        setPaymentResult({ success: true, payment: testResult.payment });
        return { success: true, ...testResult };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || '결제에 실패했습니다';
      setError(errorMessage);
      setPaymentResult({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // 결제 취소
  const cancelPayment = useCallback(async (paymentId, reason, identifier = {}) => {
    setLoading(true);
    try {
      const { data } = await paymentsAPI.cancel(paymentId, {
        reason,
        ...identifier
      });
      return { success: true, payment: data.payment };
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // 결제 상태 조회
  const checkPaymentStatus = useCallback(async (paymentId) => {
    try {
      const { data } = await paymentsAPI.getById(paymentId);
      return data;
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    error,
    paymentResult,
    initiateTossPayment,
    cancelPayment,
    checkPaymentStatus,
    isTossApp: isTossApp()
  };
}

export default useTossPayment;

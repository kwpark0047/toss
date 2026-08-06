import { useState, useCallback } from 'react';
import { paymentsAPI } from '../api';

// 토스 앱 환경 체크
const isTossApp = () => {
  return typeof window !== 'undefined' && window.TossApp !== undefined;
};

// 토스페이먼츠 클라이언트 키 (기본 테스트 키 제공)
const TOSS_CLIENT_KEY =
  import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_ck_D54YPdW9w8NE198759v8Vj7ByY6f';

// 토스페이먼츠 웹 SDK 동적 로드 헬퍼
const loadTossPayments = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    if (window.TossPayments) {
      resolve(window.TossPayments);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    script.onload = () => resolve(window.TossPayments);
    script.onerror = () => reject(new Error('Toss Payments SDK를 로드하는 데 실패했습니다.'));
    document.head.appendChild(script);
  });
};

export function useTossPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // 토스페이 결제 실행
  const initiateTossPayment = useCallback(
    async ({ orderId, storeId, totalAmount, pointAmount = 0, tossUserKey, phone, capability }) => {
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
            phone,
          });

          setPaymentResult({ success: true, payment: pointResult.payment });
          return { success: true, payment: pointResult.payment };
        }

        // 1. 서버에서 결제 준비 (Ready)
        const { data: payment } = await paymentsAPI.prepare(
          {
            order_id: orderId,
            store_id: storeId,
            amount: totalAmount,
            method: 'CARD',
          },
          capability
        );

        // 2. 토스 앱 SDK 호출 (Web Bridge)
        const appCheckoutPayment =
          typeof window !== 'undefined' ? window.TossApp?.checkoutPayment : undefined;
        if (isTossApp() && payment.pay_token && typeof appCheckoutPayment === 'function') {
          try {
            // 사용자가 결제창을 닫거나 취소하는 경우 대비
            const result = await appCheckoutPayment({
              payToken: payment.pay_token,
            });

            if (result.status === 'success') {
              // 3. 결제 성공 - 서버에 최종 승인 요청 (Capture)
              const { data: confirmed } = await paymentsAPI.confirm(
                payment.payment_id,
                {
                  paymentKey: result.paymentKey,
                  orderId: payment.order_number,
                  amount: totalAmount,
                  customerKey: tossUserKey,
                },
                capability
              );

              setPaymentResult({
                success: true,
                payment: confirmed.payment,
                pointsEarned: confirmed.points_earned,
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
              toss_user_key: tossUserKey,
            });
            throw tossError;
          }
        } else {
          // [웹 브라우저 환경] 표준 토스페이먼츠 SDK 호출
          console.info('[TossPayments] 웹 브라우저 환경: Toss Payments Web SDK를 로딩합니다.');
          const TossPayments = await loadTossPayments();
          if (!TossPayments) {
            throw new Error('Toss Payments SDK를 활성화할 수 없습니다.');
          }

          const tossPayments = TossPayments(TOSS_CLIENT_KEY);

          // 성공 및 실패 시 리다이렉트 쿼리 파라미터 조립
          try {
            sessionStorage.setItem(
              `wm_pending_payment:${payment.payment_id}`,
              JSON.stringify({
                paymentId: String(payment.payment_id),
                orderId: String(orderId),
                providerOrderId: payment.order_number,
                amount: totalAmount,
                capability: capability || null,
                createdAt: Date.now(),
              })
            );
          } catch {
            throw new Error('결제 세션을 저장할 수 없습니다. 브라우저 설정을 확인해 주세요.');
          }

          const redirectMetadata = `?payment_id=${payment.payment_id}&phone=${encodeURIComponent(phone || '')}&tossUserKey=${tossUserKey || ''}`;

          await tossPayments.requestPayment('카드', {
            amount: totalAmount,
            orderId: payment.order_number,
            orderName: `WeMarket 주문 - ${payment.order_number}`,
            successUrl: window.location.origin + '/payment/success' + redirectMetadata,
            failUrl: window.location.origin + '/payment/fail' + redirectMetadata,
            customerMobilePhone: phone,
          });

          // 리다이렉트 결제가 진행되므로 펜딩 상태 반환
          return { success: true, pendingRedirect: true };
        }
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message || '결제에 실패했습니다';
        setError(errorMessage);
        setPaymentResult({ success: false, error: errorMessage });
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 결제 취소
  const cancelPayment = useCallback(async (paymentId, reason, identifier = {}) => {
    setLoading(true);
    try {
      const { data } = await paymentsAPI.cancel(paymentId, {
        reason,
        ...identifier,
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
    isTossApp: isTossApp(),
  };
}

export default useTossPayment;

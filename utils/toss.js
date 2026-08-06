const axios = require('axios');
const cb = require('./circuitBreaker');

/**
 * [토스페이먼츠 API 연동 유틸리티]
 * 결제 승인, 조회, 취소 등 토스페이먼츠 API와의 통신을 담당합니다.
 * Circuit Breaker 적용: 연속 5회 실패 시 30초 동안 자동 차단.
 */

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;
const logger = require('../utils/logger');
const tossCircuit = cb.get('toss-api', {
  failureThreshold: 5,
  cooldownMs: 30_000,
  timeoutMs: 10_000,
});

const maskPaymentKey = (paymentKey) => {
  if (typeof paymentKey !== 'string' || paymentKey.length <= 8) return '****';
  return `****${paymentKey.slice(-8)}`;
};

if (!TOSS_SECRET_KEY) {
  logger.warn('[Warning] TOSS_SECRET_KEY가 설정되지 않았습니다. 결제 기능이 제한될 수 있습니다.');
}

// mock_ 키는 명시적 테스트 모드(test + ALLOW_MOCK_PAYMENTS)에서만 허용.
// 프로덕션에서 위조 키가 실제 API로 안 가고 통과되는 걸 막는다.
const isMockAllowed = (paymentKey) =>
  process.env.NODE_ENV === 'test' &&
  process.env.ALLOW_MOCK_PAYMENTS === 'true' &&
  typeof paymentKey === 'string' &&
  paymentKey.startsWith('mock_');

/**
 * Basic 인증 헤더 생성
 */
const getAuthHeader = () => {
  return {
    // 시크릿 키 뒤에 콜론(:)을 붙여 Base64로 인코딩해야 함
    Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  };
};

const TossAPI = {
  /**
   * 1. 결제 승인 (Confirm)
   * 결제창 호출 후 발급받은 paymentKey를 이용해 실제 승인을 요청합니다.
   */
  confirmPayment: async (paymentKey, orderId, amount) => {
    // [테스트 시뮬레이션 모드] mock_ 키는 명시적 테스트 환경에서만 성공 응답 반환
    if (isMockAllowed(paymentKey)) {
      logger.info('[Mock] 결제 승인 시뮬레이션', { paymentKey: maskPaymentKey(paymentKey) });
      return {
        paymentKey: paymentKey,
        orderId: orderId,
        amount: amount,
        method: 'card',
        status: 'DONE',
        approvedAt: new Date().toISOString(),
        receipt: { url: 'http://mock-receipt-url.com' },
        card: { company: '비씨카드', number: '1234-****-****-****', installmentMonths: 0 },
        totalAmount: amount,
      };
    }

    return tossCircuit.call(async () => {
      try {
        const response = await axios.post(
          'https://api.tosspayments.com/v1/payments/confirm',
          { paymentKey, orderId, amount },
          { headers: getAuthHeader() }
        );
        return response.data;
      } catch (error) {
        logger.error(error);
        throw Object.assign(
          new Error(error.response?.data?.message || '결제 승인 중 오류가 발생했습니다.'),
          {
            code: error.response?.data?.code || 'PAYMENT_CONFIRM_ERROR',
            statusCode: error.response?.status || 500,
          }
        );
      }
    });
  },

  /**
   * 1-1. 브랜드페이 결제 승인
   * 브랜드페이 전용 승인 API를 호출합니다.
   */
  confirmBrandPay: async (paymentKey, orderId, amount, customerKey) => {
    try {
      const response = await axios.post(
        'https://api.tosspayments.com/v1/brandpay/payments/confirm',
        { paymentKey, orderId, amount, customerKey },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error) {
      logger.error(error);
      throw Object.assign(
        new Error(error.response?.data?.message || '브랜드페이 승인 중 오류가 발생했습니다.'),
        {
          code: error.response?.data?.code || 'BRANDPAY_CONFIRM_ERROR',
          statusCode: error.response?.status || 500,
        }
      );
    }
  },

  /**
   * 2. 결제 상세 조회
   * paymentKey를 이용해 결제 현황을 조회합니다.
   */
  getPayment: async (paymentKey) => {
    try {
      const response = await axios.get(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error) {
      throw Object.assign(
        new Error(error.response?.data?.message || '결제 조회 중 오류가 발생했습니다.'),
        {
          code: error.response?.data?.code || 'PAYMENT_GET_ERROR',
          statusCode: error.response?.status || 500,
        }
      );
    }
  },

  /**
   * 3. 결제 취소 (Refund)
   * 승인된 결제를 전체 또는 부분 취소합니다.
   */
  cancelPayment: async (paymentKey, cancelReason, cancelAmount, idempotencyKey) => {
    // [테스트 시뮬레이션 모드]
    if (isMockAllowed(paymentKey)) {
      logger.info('[Mock] 결제 취소 시뮬레이션', { paymentKey: maskPaymentKey(paymentKey) });
      return {
        paymentKey: paymentKey,
        status: 'CANCELED',
        cancelReason,
        cancels: [{ cancelAmount, cancelReason }],
      };
    }

    const headers = getAuthHeader();
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    return tossCircuit.call(async () => {
      try {
        const response = await axios.post(
          `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
          { cancelReason, cancelAmount },
          { headers }
        );
        return response.data;
      } catch (error) {
        throw Object.assign(
          new Error(error.response?.data?.message || '결제 취소 중 오류가 발생했습니다.'),
          {
            code: error.response?.data?.code || 'PAYMENT_CANCEL_ERROR',
            statusCode: error.response?.status || 500,
          }
        );
      }
    });
  },

  /**
   * 결제 수단 한글화 메시지
   */
  getMethodMessage: (method) => {
    if (!method) return '알 수 없음';
    if (typeof method === 'string') return method;
    return method.type || '카드';
  },

  /**
   * 결제 상태 한글화 메시지
   */
  getStatusMessage: (status) => {
    const messages = {
      READY: '준비',
      IN_PROGRESS: '진행중',
      WAITING_FOR_DEPOSIT: '입금대기',
      DONE: '완료',
      CANCELED: '취소',
      PARTIAL_CANCELED: '부분취소',
      ABORTED: '실패',
      EXPIRED: '만료',
    };
    return messages[status] || status;
  },
};

module.exports = TossAPI;

import axios from 'axios';
import { get } from './circuitBreaker.js';
import logger from '../utils/logger.js';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

const tossCircuit = get('toss-api', {
  failureThreshold: 5,
  cooldownMs: 30_000,
  timeoutMs: 10_000,
});

const maskPaymentKey = (paymentKey: string): string => {
  if (typeof paymentKey !== 'string' || paymentKey.length <= 8) return '****';
  return `****${paymentKey.slice(-8)}`;
};

if (!TOSS_SECRET_KEY) {
  logger.warn('[Warning] TOSS_SECRET_KEY가 설정되지 않았습니다. 결제 기능이 제한될 수 있습니다.');
}

// mock_ 키는 명시적 테스트 모드(test + ALLOW_MOCK_PAYMENTS)에서만 허용.
// 프로덕션에서 위조 키가 실제 API로 안 가고 통과되는 걸 막는다.
const isMockAllowed = (paymentKey: string): boolean =>
  process.env.NODE_ENV === 'test' &&
  process.env.ALLOW_MOCK_PAYMENTS === 'true' &&
  typeof paymentKey === 'string' &&
  paymentKey.startsWith('mock_');

/**
 * Basic 인증 헤더 생성
 */
const getAuthHeader = () => {
  return {
    Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  };
};

/**
 * 에러 로깅 시 민감정보 제거
 */
const sanitizeError = (error: any): any => {
  if (!error) return error;
  const sanitized = { ...error };
  if (sanitized.response?.data) {
    sanitized.response.data = sanitizeTossResponse(sanitized.response.data);
  }
  if (sanitized.config?.data) {
    try {
      const parsed = JSON.parse(sanitized.config.data);
      sanitized.config.data = sanitizeTossResponse(parsed);
    } catch {
      // 데이터가 JSON이 아닌 경우 그대로 유지
    }
  }
  return sanitized;
};

/**
 * 토스페이먼츠 응답에서 민감정보 제거
 */
const sanitizeTossResponse = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  const cleaned = JSON.parse(JSON.stringify(data));
  const SENSITIVE_FIELDS = [
    'card', 'secret', 'customerKey', 'customer_key', 'cardPassword', 'credential',
    'billingKey', 'customerEmail', 'customerName', 'phoneNumber', 'email', 'name',
    'cardNumber', 'password', 'cvc', 'expiry', 'authNumber',
  ];
  const removeSensitive = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        removeSensitive(obj[key]);
      }
    }
  };
  removeSensitive(cleaned);
  return cleaned;
};

const TossAPI = {
  /**
   * 1. 결제 승인 (Confirm)
   * 결제창 호출 후 발급받은 paymentKey를 이용해 실제 승인을 요청합니다.
   */
  confirmPayment: async (paymentKey: string, orderId: string, amount: number) => {
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
      } catch (error: any) {
        logger.error(sanitizeError(error));
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
  confirmBrandPay: async (paymentKey: string, orderId: string, amount: number, customerKey: string) => {
    try {
      const response = await axios.post(
        'https://api.tosspayments.com/v1/brandpay/payments/confirm',
        { paymentKey, orderId, amount, customerKey },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
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
  getPayment: async (paymentKey: string) => {
    try {
      const response = await axios.get(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
        headers: getAuthHeader(),
      });
      return response.data;
    } catch (error: any) {
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
  cancelPayment: async (paymentKey: string, cancelReason: string, cancelAmount: number, idempotencyKey?: string) => {
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
      } catch (error: any) {
        logger.error(sanitizeError(error));
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
  getMethodMessage: (method: any): string => {
    if (!method) return '알 수 없음';
    if (typeof method === 'string') return method;
    return method.type || '카드';
  },

  /**
   * 결제 상태 한글화 메시지
   */
  getStatusMessage: (status: string): string => {
    const messages: Record<string, string> = {
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

  // ─────────────────────────────────────────────────────────────────
  // BrandPay 정기결제 (Subscription) API
  // ─────────────────────────────────────────────────────────────────

  /**
   * 1. 빌링키 발급 (고객 결제 수단 등록)
   * 고객이 결제 수단을 등록하면 빌링키를 발급받아 저장
   */
  issueBillingKey: async (customerKey: string, method: string, card: any = null, easyPay: any = null) => {
    if (isMockAllowed(customerKey)) {
      logger.info('[Mock] 빌링키 발급 시뮬레이션', { customerKey });
      return {
        billingKey: `mock_billing_${Date.now()}`,
        customerKey,
        method,
        card: card ? { company: '비씨카드', number: '1234-****-****-****' } : null,
        easyPay,
      };
    }

    return tossCircuit.call(async () => {
      try {
        const body = { customerKey, method };
        if (card) body.card = card;
        if (easyPay) body.easyPay = easyPay;

        const response = await axios.post(
          'https://api.tosspayments.com/v1/billing/authorizations/issue',
          body,
          { headers: getAuthHeader() }
        );
        return response.data;
      } catch (error: any) {
        logger.error(sanitizeError(error));
        throw Object.assign(
          new Error(error.response?.data?.message || '빌링키 발급 중 오류가 발생했습니다.'),
          {
            code: error.response?.data?.code || 'BILLING_KEY_ISSUE_ERROR',
            statusCode: error.response?.status || 500,
          }
        );
      }
    });
  },

  /**
   * 2. 빌링키로 결제 요청 (정기결제 실행)
   * 저장된 빌링키로 자동 결제 수행
   */
  payWithBillingKey: async (
    billingKey: string,
    customerKey: string,
    amount: number,
    orderId: string,
    orderName: string,
    customerEmail: string | null = null,
    customerName: string | null = null,
    taxFreeAmount: number = 0
  ) => {
    if (isMockAllowed(billingKey)) {
      logger.info('[Mock] 빌링키 결제 시뮬레이션', { billingKey: maskPaymentKey(billingKey) });
      return {
        paymentKey: `mock_pay_${Date.now()}`,
        orderId,
        amount,
        status: 'DONE',
        approvedAt: new Date().toISOString(),
        receipt: { url: 'http://mock-receipt-url.com' },
      };
    }

    return tossCircuit.call(async () => {
      try {
        const response = await axios.post(
          'https://api.tosspayments.com/v1/billing/payments',
          {
            billingKey,
            customerKey,
            amount,
            orderId,
            orderName,
            customerEmail,
            customerName,
            taxFreeAmount,
          },
          { headers: getAuthHeader() }
        );
        return response.data;
      } catch (error: any) {
        logger.error(sanitizeError(error));
        throw Object.assign(
          new Error(error.response?.data?.message || '빌링키 결제 중 오류가 발생했습니다.'),
          {
            code: error.response?.data?.code || 'BILLING_PAYMENT_ERROR',
            statusCode: error.response?.status || 500,
          }
        );
      }
    });
  },

  /**
   * 3. 정기결제 예약 생성 (Subscription 예약)
   * 토스 정기결제 API로 주기적 결제 예약
   */
  createSubscription: async (billingKey: string, customerKey: string, plan: any) => {
    try {
      const response = await axios.post(
        'https://api.tosspayments.com/v1/subscriptions',
        {
          billingKey,
          customerKey,
          plan: {
            interval: plan.interval || 'month',
            amount: plan.amount,
            orderName: plan.orderName,
            executeTime: plan.executeTime || '00:00',
            startDate: plan.startDate || new Date().toISOString().slice(0, 10),
          },
        },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 예약 생성 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_CREATE_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },

  /**
   * 4. 정기결제 조회
   */
  getSubscription: async (subscriptionId: string) => {
    try {
      const response = await axios.get(
        `https://api.tosspayments.com/v1/subscriptions/${subscriptionId}`,
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 조회 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_GET_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },

  /**
   * 5. 정기결제 취소
   */
  cancelSubscription: async (subscriptionId: string, cancelReason = '고객 요청') => {
    try {
      const response = await axios.post(
        `https://api.tosspayments.com/v1/subscriptions/${subscriptionId}/cancel`,
        { cancelReason },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 취소 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_CANCEL_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },

  /**
   * 6. 정기결제 일시정지
   */
  pauseSubscription: async (subscriptionId: string, pauseReason = '일시정지') => {
    try {
      const response = await axios.post(
        `https://api.tosspayments.com/v1/subscriptions/${subscriptionId}/pause`,
        { pauseReason },
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 일시정지 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_PAUSE_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },

  /**
   * 7. 정기결제 재개
   */
  resumeSubscription: async (subscriptionId: string) => {
    try {
      const response = await axios.post(
        `https://api.tosspayments.com/v1/subscriptions/${subscriptionId}/resume`,
        {},
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 재개 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_RESUME_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },

  /**
   * 8. 정기결제 결제 내역 조회
   */
  getSubscriptionPayments: async (subscriptionId: string) => {
    try {
      const response = await axios.get(
        `https://api.tosspayments.com/v1/subscriptions/${subscriptionId}/payments`,
        { headers: getAuthHeader() }
      );
      return response.data;
    } catch (error: any) {
      logger.error(sanitizeError(error));
      throw Object.assign(new Error(error.response?.data?.message || '정기결제 내역 조회 실패'), {
        code: error.response?.data?.code || 'SUBSCRIPTION_PAYMENTS_ERROR',
        statusCode: error.response?.status || 500,
      });
    }
  },
};

export default TossAPI;
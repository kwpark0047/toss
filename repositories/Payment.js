const prisma = require('../config/prisma');
const { encryptPhone } = require('../utils/phoneEncryption');

// raw_response에 포함된 민감 필드 목록 (저장 전 제거)
const SENSITIVE_FIELDS = [
  'card', 'secret', 'customerKey', 'customer_key',
  'cardPassword', 'credential'
];

// raw_response에서 민감 필드를 재귀적으로 제거
const sanitizeRawResponse = (data) => {
  if (!data) return data;
  const cleaned = JSON.parse(JSON.stringify(data));
  const removeSensitive = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        removeSensitive(obj[key]);
      }
    }
  };
  removeSensitive(cleaned);
  return cleaned;
};

/**
 * 결제 모델 (Prisma 기반)
 * 결제 생성, 승인, 취소 및 통계 조회를 담당합니다.
 */
const Payment = {
  // 결제 생성
  create: async (data) => {
    const {
      order_id, store_id, payment_key, order_name, amount,
      status = 'READY', checkout_url
    } = data;

    return await prisma.payments.create({
      data: {
        order_id,
        store_id,
        payment_key: payment_key || null,
        order_name,
        amount,
        status,
        method: 'READY',
        checkout_url: checkout_url || null,
        payer_phone: data.payer_phone ? encryptPhone(data.payer_phone) : null,
        is_partial: data.is_partial || false,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
  },

  // ID로 결제 조회
  findById: async (id) => {
    return await prisma.payments.findUnique({
      where: { id }
    });
  },

  // 결제 키로 조회
  findByPaymentKey: async (paymentKey) => {
    return await prisma.payments.findUnique({
      where: { payment_key: paymentKey }
    });
  },

  // 주문 ID로 결제 목록 조회
  findByOrderId: async (orderId) => {
    return await prisma.payments.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' }
    });
  },

  // 매장별 결제 목록 조회 (주문 번호 포함)
  findByStoreId: async (storeId, status = null, limit = 50) => {
    const where = { store_id: storeId };
    if (status) where.status = status;

    return await prisma.payments.findMany({
      where,
      include: {
        orders: {
          select: { order_number: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit
    });
  },

  // 결제 키 업데이트
  updatePaymentKey: async (id, paymentKey) => {
    return await prisma.payments.update({
      where: { id },
      data: {
        payment_key: paymentKey,
        updated_at: new Date()
      }
    });
  },

  // 주문 ID 기반 결제 키 업데이트 (READY 상태 대상)
  updatePaymentKeyByOrder: async (orderId, paymentKey) => {
    const result = await prisma.payments.updateMany({
      where: {
        order_id: orderId,
        OR: [
          { status: 'READY' },
          { payment_key: null }
        ]
      },
      data: {
        payment_key: paymentKey,
        updated_at: new Date()
      }
    });

    return result.count > 0;
  },

  // 결제 승인
  approve: async (paymentKey, data) => {
    const {
      method, status, approved_at, receipt_url,
      card_company, card_number, installment_months,
      easy_pay_provider, raw_response
    } = data;

    return await prisma.payments.update({
      where: { payment_key: paymentKey },
      data: {
        method,
        status,
        approved_at: approved_at ? new Date(approved_at) : new Date(),
        receipt_url,
        card_company: card_company || null,
        card_number: card_number || null,
        installment_months: installment_months || 0,
        easy_pay_provider: easy_pay_provider || null,
        payer_phone: data.payer_phone ? encryptPhone(data.payer_phone) : null,    // [추가] 승인 시 결제자 정보 업데이트
        is_partial: data.is_partial || false,      // [추가] 부분 결제 여부 업데이트
        raw_response: raw_response ? JSON.stringify(sanitizeRawResponse(raw_response)) : null,
        updated_at: new Date()
      }
    });
  },

  // 결제 취소
  cancel: async (paymentKey, cancelReason) => {
    return await prisma.payments.update({
      where: { payment_key: paymentKey },
      data: {
        status: 'CANCELED',
        cancelled_at: new Date(),
        cancel_reason: cancelReason,
        updated_at: new Date()
      }
    });
  },

  // 결제 실패 처리
  fail: async (paymentKey, failureCode, failureMessage) => {
    return await prisma.payments.update({
      where: { payment_key: paymentKey },
      data: {
        status: 'ABORTED',
        failure_code: failureCode,
        failure_message: failureMessage,
        updated_at: new Date()
      }
    });
  },

  // 결제 통계 조회
  getStats: async (storeId, startDate = null, endDate = null) => {
    const where = {
      store_id: storeId,
      status: 'DONE'
    };

    if (startDate && endDate) {
      where.approved_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else {
      // 오늘 기준
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.approved_at = {
        gte: today
      };
    }

    // 전체 합계 및 건수
    const aggregate = await prisma.payments.aggregate({
      where,
      _count: true,
      _sum: {
        amount: true
      }
    });

    // 결제 수단별 통계 (Prisma에서는 groupBy 사용)
    const byMethod = await prisma.payments.groupBy({
      by: ['method'],
      where,
      _count: true,
      _sum: {
        amount: true
      }
    });

    return {
      total_count: aggregate._count,
      total_amount: aggregate._sum.amount || 0,
      by_method: byMethod.map(m => ({
        method: m.method,
        count: m._count,
        total: m._sum.amount || 0
      }))
    };
  }
};

module.exports = Payment;

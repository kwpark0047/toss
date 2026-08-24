/**
 * 주문/결제 관련 Zod 검증 스키마 (body 직접 스키마)
 */

const { z } = require('zod');

const priceSchema = z.number().int().min(0).max(100000000);
const phoneSchema = z.string().regex(/^01[0-9][0-9]{7,8}$/);
const accountNumberSchema = z.string().regex(/^\d{10,14}$/);

// 주문 생성
const createOrderSchema = z.object({
  storeId: z.number().int().positive(),
  tableId: z.number().int().positive().optional().nullable(),
  waitingId: z.number().int().positive().optional().nullable(),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: phoneSchema.optional(),
  customerEmail: z.string().email().max(255).optional().nullable(),
  orderType: z.enum(['dine_in', 'takeout', 'delivery']).default('dine_in'),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    productName: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(999),
    unitPrice: priceSchema,
    totalPrice: priceSchema,
    options: z.array(z.object({
      optionName: z.string().max(100),
      optionItemName: z.string().max(100),
      price: priceSchema.default(0),
    })).default([]),
    specialRequest: z.string().max(500).optional().nullable(),
  })).min(1, '주문 항목은 최소 1개 필요합니다.').max(100),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'kakao_pay', 'naver_pay', 'toss_pay', 'point', 'mixed']).default('card'),
  paymentDetails: z.object({
    cardType: z.string().max(50).optional(),
    cardNumber: z.string().max(20).optional(),
    installmentMonths: z.number().int().min(0).max(12).default(0),
    tossPaymentKey: z.string().optional(),
    kakaoPayTid: z.string().optional(),
    naverPayOrderId: z.string().optional(),
  }).optional(),
  splitPayment: z.enum(['none', 'equal', 'item']).default('none'),
  splitCount: z.number().int().min(2).max(10).optional(),
  splitAmounts: z.array(priceSchema).optional(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  deliveryDetailAddress: z.string().max(500).optional().nullable(),
  deliveryZipCode: z.string().regex(/^\d{5}$/).optional().nullable(),
  deliveryRequest: z.string().max(500).optional().nullable(),
  deliveryFee: priceSchema.default(0),
  couponCode: z.string().max(50).optional().nullable(),
  usedPoints: z.number().int().min(0).default(0),
  memo: z.string().max(1000).optional().nullable(),
  packagingType: z.enum(['none', 'basic', 'premium', 'eco']).default('basic'),
  packagingFee: priceSchema.default(0),
});

// 주문 상태 변경
const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled',
    'refunded',
    'partially_refunded',
  ]),
  reason: z.string().max(500).optional().nullable(),
  cancelReason: z.enum([
    'customer_request',
    'store_closed',
    'out_of_stock',
    'payment_failed',
    'duplicate_order',
    'other',
  ]).optional(),
});

// 주문 취소
const cancelOrderSchema = z.object({
  reason: z.enum([
    'customer_request',
    'store_closed',
    'out_of_stock',
    'payment_failed',
    'duplicate_order',
    'other',
  ]),
  reasonDetail: z.string().max(500).optional().nullable(),
  refundType: z.enum(['full', 'partial', 'points_only']).default('full'),
  refundAmount: priceSchema.optional(),
  excludeRefundAmount: priceSchema.optional(),
});

// 주문 반품/교환
const returnExchangeSchema = z.object({
  type: z.enum(['return', 'exchange']),
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    reason: z.enum([
      'defective',
      'wrong_item',
      'not_as_described',
      'customer_changed_mind',
      'late_delivery',
      'other',
    ]),
    reasonDetail: z.string().max(500).optional().nullable(),
    exchangeProductId: z.number().int().positive().optional(),
    exchangeQuantity: z.number().int().min(1).optional(),
  })).min(1),
  retrieveType: z.enum(['store_pickup', 'courier', 'customer_send']).default('courier'),
  retrieveAddress: z.string().max(500).optional().nullable(),
  retrieveContact: z.object({
    name: z.string().max(100),
    phone: phoneSchema,
    address: z.string().max(500),
    detailAddress: z.string().max(500).optional(),
    zipCode: z.string().regex(/^\d{5}$/).optional(),
  }).optional(),
});

// 결제 생성
const createPaymentSchema = z.object({
  orderId: z.number().int().positive(),
  amount: priceSchema,
  method: z.enum(['cash', 'card', 'transfer', 'kakao_pay', 'naver_pay', 'toss_pay', 'point']),
  paymentDetails: z.object({
    cardType: z.string().max(50).optional(),
    cardNumber: z.string().max(20).optional(),
    installmentMonths: z.number().int().min(0).max(12).default(0),
    tossPaymentKey: z.string().optional(),
    kakaoPayTid: z.string().optional(),
    naverPayOrderId: z.string().optional(),
    cardApprovalNumber: z.string().max(20).optional(),
    cardIssuerCode: z.string().max(10).optional(),
    cardAcquirerCode: z.string().max(10).optional(),
    receiptUrl: z.string().url().optional(),
  }).optional(),
  isPartial: z.boolean().default(false),
  parentPaymentId: z.number().int().positive().optional().nullable(),
});

// 결제 승인 (토스페이먼츠 등)
const confirmPaymentSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: priceSchema,
});

// 결제 취소
const cancelPaymentSchema = z.object({
  cancelReason: z.string().min(1).max(200),
  cancelAmount: priceSchema.optional(),
  refundableAmount: priceSchema.optional(),
  taxFreeAmount: priceSchema.optional(),
  vatAmount: priceSchema.optional(),
});

// 주문 검색 쿼리
const orderSearchQuerySchema = z.object({
  storeId: z.coerce.number().int().positive().optional(),
  status: z.enum([
    'pending', 'confirmed', 'preparing', 'ready', 'completed',
    'cancelled', 'refunded', 'partially_refunded',
  ]).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'cancelled', 'refunded']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'kakao_pay', 'naver_pay', 'toss_pay', 'point', 'mixed']).optional(),
  customerPhone: phoneSchema.optional(),
  orderNumber: z.string().max(50).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created', 'updated', 'total_amount']).default('created'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// 주문 ID 파라미터
const orderIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// 주문 번호 파라미터
const orderNumberParamSchema = z.object({
  orderNumber: z.string().min(1).max(50),
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  returnExchangeSchema,
  createPaymentSchema,
  confirmPaymentSchema,
  cancelPaymentSchema,
  orderSearchQuerySchema,
  orderIdParamSchema,
  orderNumberParamSchema,
  priceSchema,
  phoneSchema,
};
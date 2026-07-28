const { AppError } = require('../../../utils/errorHandler');

// ── Manual mocks ──────────────────────────────────────────
jest.mock('../../../utils/toss', () => ({
  confirmPayment: jest.fn(),
  cancelPayment: jest.fn(),
  confirmBrandPay: jest.fn(),
}));

jest.mock('../../../utils/notifications', () => ({
  sendNewOrderNotification: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../services/PointsService', () => ({
  use: jest.fn(),
  earn: jest.fn(),
  calculateEarnPoints: jest.fn(),
  revertOnCancel: jest.fn(),
}));

jest.mock('../../../services/LedgerService', () => ({
  recordIncome: jest.fn(),
  recordRefund: jest.fn(),
}));

jest.mock('../../../services/AnomalyDetectionService', () => ({
  checkSalesAnomaly: jest.fn(),
}));

jest.mock('../../../utils/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = 'AppError';
    }
  },
}));

// prisma uses a Proxy — must provide a manual factory
jest.mock('../../../config/prisma', () => ({
  $transaction: jest.fn(),
  orders: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  payments: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  },
  products: { findUnique: jest.fn() },
  stores: { findUnique: jest.fn() },
  order_items: { findMany: jest.fn() },
  store_customers: { upsert: jest.fn() },
  stock_history: { create: jest.fn() },
  ledger: { create: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────
const TossAPI = require('../../../utils/toss');
const notificationUtils = require('../../../utils/notifications');
const prisma = require('../../../config/prisma');
const pointService = require('../../../services/PointsService');
const ledgerService = require('../../../services/LedgerService');

const PaymentService = require('../../../services/PaymentService');

// ── Shared mocks ──────────────────────────────────────────
const mockTx = {
  products: { findUnique: jest.fn() },
  orders: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
  payments: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  },
  order_items: { findMany: jest.fn() },
  store_customers: { upsert: jest.fn() },
  stock_history: { create: jest.fn() },
  ledger: { create: jest.fn() },
};

describe('PaymentService', () => {
  let service;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();

    // $transaction: callback form by default
    prisma.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(mockTx);
      return Promise.all(Array.from(fn));
    });

    mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    service = new PaymentService(mockIo);
  });

  // ─────────────────────────────────────────────────────────
  // preparePayment
  // ─────────────────────────────────────────────────────────
  describe('preparePayment', () => {
    test('creates a READY payment with store_id and amount', async () => {
      prisma.payments.create.mockResolvedValue({ id: 99 });

      const result = await service.preparePayment({
        store_id: 1,
        amount: 50000,
        order_name: '테스트 주문',
      });

      expect(result).toEqual({ paymentId: 99 });
      expect(prisma.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ store_id: 1, amount: 50000, status: 'READY' }),
        })
      );
    });

    test('falls back to order data when store_id or amount missing', async () => {
      prisma.orders.findUnique.mockResolvedValue({ id: 5, store_id: 5, total_amount: 30000 });
      prisma.payments.create.mockResolvedValue({ id: 42 });

      const result = await service.preparePayment({ order_id: 5 });

      expect(prisma.orders.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(prisma.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ store_id: 5, amount: 30000 }) })
      );
      expect(result).toEqual({ paymentId: 42 });
    });

    test('throws AppError(400) when store_id missing and no order', async () => {
      await expect(service.preparePayment({ amount: 10000 })).rejects.toThrow(AppError);
    });

    test('throws AppError(400) when amount missing and no order', async () => {
      await expect(service.preparePayment({ store_id: 1 })).rejects.toThrow(AppError);
    });
  });

  // ─────────────────────────────────────────────────────────
  // processDirectPayment — cash / point / store_card
  // ─────────────────────────────────────────────────────────
  describe('processDirectPayment', () => {
    const baseInput = {
      store_id: '1',
      items: [{ product_id: 10, product_name: '아메리카노', quantity: 2, price: 3000 }],
      total_amount: '6000',
      payment_method: 'cash',
    };

    test('creates order + payment for cash and marks DONE', async () => {
      mockTx.products.findUnique.mockResolvedValue({
        id: 10,
        store_id: 1,
        name: '아메리카노',
        is_sold_out: false,
        is_active: true,
      });
      mockTx.orders.create.mockResolvedValue({
        id: 100,
        order_number: '20260720-0001',
        store_id: 1,
        total_amount: 6000,
      });
      mockTx.payments.create.mockResolvedValue({ id: 200, status: 'DONE', order_id: 100 });
      mockTx.store_customers.upsert.mockResolvedValue({});
      pointService.use.mockResolvedValue({});
      pointService.calculateEarnPoints.mockResolvedValue(60);
      pointService.earn.mockResolvedValue({});
      ledgerService.recordIncome.mockResolvedValue({});
      mockTx.orders.update.mockResolvedValue({});

      const result = await service.processDirectPayment(baseInput);

      expect(prisma.$transaction).toHaveBeenCalled();
      // Order created inside transaction
      expect(mockTx.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ store_id: 1, status: 'pending', total_amount: 6000 }),
        })
      );
      // Payment created as DONE for cash
      expect(mockTx.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DONE' }) })
      );
      // IO events
      expect(mockIo.to).toHaveBeenCalledWith('store - 1');
      expect(result.order_id).toBe(100);
      expect(result.status).toBe('DONE');
    });

    test('throws AppError when items array is empty', async () => {
      await expect(service.processDirectPayment({ ...baseInput, items: [] })).rejects.toThrow(
        AppError
      );
    });

    test('throws AppError when product is sold out', async () => {
      mockTx.products.findUnique.mockResolvedValue({
        id: 10,
        store_id: 1,
        name: '아메리카노',
        is_sold_out: true,
        is_active: true,
      });
      await expect(service.processDirectPayment(baseInput)).rejects.toThrow(AppError);
    });

    test('throws AppError when product is inactive', async () => {
      mockTx.products.findUnique.mockResolvedValue({
        id: 10,
        store_id: 1,
        name: '아메리카노',
        is_sold_out: false,
        is_active: false,
      });
      await expect(service.processDirectPayment(baseInput)).rejects.toThrow(AppError);
    });
  });

  // ─────────────────────────────────────────────────────────
  // processCancellation
  // ─────────────────────────────────────────────────────────
  describe('processCancellation', () => {
    const donePayment = {
      id: 1,
      order_id: 10,
      payment_key: 'toss_key_abc',
      amount: 50000,
      store_id: 1,
      method: 'CARD',
    };

    test('cancels DONE payment via Toss API and updates DB', async () => {
      prisma.payments.findFirst.mockResolvedValueOnce(donePayment);
      prisma.payments.findFirst.mockResolvedValueOnce(null);
      TossAPI.cancelPayment.mockResolvedValue({});

      const result = await service.processCancellation(10, '고객 요청');

      expect(TossAPI.cancelPayment).toHaveBeenCalledWith('toss_key_abc', '고객 요청');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: '결제 취소 및 환불 처리가 완료되었습니다.',
      });
    });

    test('is idempotent when already CANCELED', async () => {
      prisma.payments.findFirst.mockResolvedValueOnce(donePayment);
      prisma.payments.findFirst.mockResolvedValueOnce({ id: 99 });

      const result = await service.processCancellation(10, '중복');

      expect(result).toEqual({ success: true, message: '이미 취소 처리된 결제입니다.' });
      expect(TossAPI.cancelPayment).not.toHaveBeenCalled();
    });

    test('throws when no DONE payment exists', async () => {
      prisma.payments.findFirst.mockResolvedValueOnce(null);
      await expect(service.processCancellation(10, '취소')).rejects.toThrow(
        '취소할 유효한 결제 내역이 없습니다.'
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // handleTossWebhook
  // ─────────────────────────────────────────────────────────
  describe('handleTossWebhook', () => {
    test('ignores non-PAYMENT_STATUS_CHANGED events', async () => {
      await service.handleTossWebhook({ eventType: 'OTHER', data: {} });
      expect(prisma.orders.findFirst).not.toHaveBeenCalled();
    });

    test('ignores PAYMENT_STATUS_CHANGED with non-DONE status', async () => {
      await service.handleTossWebhook({
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: { status: 'READY' },
      });
      expect(prisma.orders.findFirst).not.toHaveBeenCalled();
    });

    test('망취소: cancels payment when order not found', async () => {
      prisma.orders.findFirst.mockResolvedValue(null);
      TossAPI.cancelPayment.mockResolvedValue({});

      await service.handleTossWebhook({
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: {
          status: 'DONE',
          paymentKey: 'key_mang',
          orderId: 'NO-ORDER-001',
          totalAmount: 15000,
        },
      });

      expect(prisma.orders.findFirst).toHaveBeenCalledWith({
        where: { order_number: 'NO-ORDER-001' },
      });
      expect(TossAPI.cancelPayment).toHaveBeenCalledWith(
        'key_mang',
        expect.stringContaining('토스측 오류')
      );
    });

    test('calls processApproval when order exists', async () => {
      prisma.orders.findFirst.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 30000,
        customer_phone: '010-1111-2222',
      });
      TossAPI.confirmPayment.mockResolvedValue({
        paymentKey: 'key_wh',
        method: 'CARD',
        totalAmount: 30000,
        card: { company: '국민', number: '9876' },
        receipt: { url: 'http://receipt' },
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 30000,
        customer_phone: '010-1111-2222',
        customer_name: '테스트',
        toss_user_key: null,
      });
      mockTx.payments.findFirst.mockResolvedValue({ id: 20, order_id: 1, status: 'READY' });
      mockTx.payments.update.mockResolvedValue({});
      mockTx.payments.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });
      mockTx.store_customers.upsert.mockResolvedValue({});
      pointService.calculateEarnPoints.mockResolvedValue(0);
      prisma.stores.findUnique.mockResolvedValue({
        id: 1,
        name: 'T',
        users: [],
        owner_phone: null,
      });

      await service.handleTossWebhook({
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: { status: 'DONE', paymentKey: 'key_wh', orderId: 'ORD-001', totalAmount: 30000 },
      });

      expect(TossAPI.confirmPayment).toHaveBeenCalledWith('key_wh', 'ORD-001', 30000);
    });
  });

  // ─────────────────────────────────────────────────────────
  // processApproval
  // ─────────────────────────────────────────────────────────
  describe('processApproval', () => {
    test('throws 400 when paymentKey is null', async () => {
      await expect(service.processApproval(null, 'ORD-001', 50000)).rejects.toThrow(AppError);
    });

    test('throws 400 when paymentKey is not a string', async () => {
      await expect(service.processApproval(12345, 'ORD-001', 50000)).rejects.toThrow(AppError);
    });

    test('calls confirmPayment for regular card and completes flow', async () => {
      TossAPI.confirmPayment.mockResolvedValue({
        paymentKey: 'pk_regular',
        method: 'CARD',
        totalAmount: 50000,
        card: { company: '신한', number: '****' },
        receipt: { url: 'https://receipt' },
      });
      // 1차 방어(_assertRequestedAmount)는 tx가 아닌 최상위 prisma를 사용한다
      prisma.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      prisma.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
        customer_phone: '010-0000-0000',
        customer_name: '홍길동',
        toss_user_key: null,
      });
      mockTx.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      mockTx.payments.update.mockResolvedValue({});
      mockTx.payments.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });
      mockTx.store_customers.upsert.mockResolvedValue({});
      pointService.calculateEarnPoints.mockResolvedValue(0);
      prisma.stores.findUnique.mockResolvedValue({
        id: 1,
        name: 'T',
        users: [],
        owner_phone: null,
      });

      const result = await service.processApproval('pk_regular', 'ORD-001', 50000);

      expect(TossAPI.confirmPayment).toHaveBeenCalledWith('pk_regular', 'ORD-001', 50000);
      expect(result.success).toBe(true);
      // PG 승인 금액으로 payments.amount 를 동기화해야 한다
      expect(mockTx.payments.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 50000, status: 'DONE' }),
        })
      );
    });

    test('calls confirmBrandPay for bp_ prefix keys', async () => {
      TossAPI.confirmBrandPay.mockResolvedValue({
        paymentKey: 'bp_bpkey',
        method: 'CARD',
        totalAmount: 30000,
        card: { company: '카카오', number: '1111' },
        receipt: { url: 'https://receipt' },
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 2,
        store_id: 1,
        order_number: 'ORD-002',
        total_amount: 30000,
        customer_phone: null,
        customer_name: null,
        toss_user_key: 'cust_key',
      });
      prisma.orders.findUnique.mockResolvedValue({
        id: 2,
        store_id: 1,
        order_number: 'ORD-002',
        total_amount: 30000,
      });
      prisma.payments.findFirst.mockResolvedValue({
        id: 11,
        order_id: 2,
        status: 'READY',
        amount: 30000,
      });
      mockTx.payments.findFirst.mockResolvedValue({
        id: 11,
        order_id: 2,
        status: 'READY',
        amount: 30000,
      });
      mockTx.payments.update.mockResolvedValue({});
      mockTx.payments.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });
      mockTx.store_customers.upsert.mockResolvedValue({});
      pointService.calculateEarnPoints.mockResolvedValue(0);
      prisma.stores.findUnique.mockResolvedValue({
        id: 1,
        name: 'T',
        users: [],
        owner_phone: null,
      });

      const result = await service.processApproval('bp_bpkey', 'ORD-002', 30000, 'cust_key');

      expect(TossAPI.confirmBrandPay).toHaveBeenCalledWith(
        'bp_bpkey',
        'ORD-002',
        30000,
        'cust_key'
      );
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // processApproval — 금액 정합성 (C-2 회귀 방지)
  // ─────────────────────────────────────────────────────────
  describe('processApproval — 금액 정합성 검증', () => {
    test('[1차 방어] 요청 금액이 READY 레코드와 다르면 PG를 호출하지 않고 400', async () => {
      prisma.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      prisma.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });

      await expect(service.processApproval('pk_x', 'ORD-001', 1000)).rejects.toThrow(AppError);
      expect(TossAPI.confirmPayment).not.toHaveBeenCalled();
    });

    test('[1차 방어] 금액이 0 이하이거나 정수가 아니면 400', async () => {
      await expect(service.processApproval('pk_x', 'ORD-001', 0)).rejects.toThrow(AppError);
      await expect(service.processApproval('pk_x', 'ORD-001', -100)).rejects.toThrow(AppError);
      await expect(service.processApproval('pk_x', 'ORD-001', 'abc')).rejects.toThrow(AppError);
      expect(TossAPI.confirmPayment).not.toHaveBeenCalled();
    });

    test('[2차 방어] PG 승인 금액이 READY 금액과 다르면 DONE 처리하지 않고 자동 취소한다', async () => {
      // 요청 금액은 정상 통과시키되, PG가 다른 금액을 승인한 상황을 재현
      prisma.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      prisma.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      TossAPI.confirmPayment.mockResolvedValue({
        paymentKey: 'pk_regular',
        method: 'CARD',
        totalAmount: 1000,
        card: {},
        receipt: {},
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      mockTx.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      TossAPI.cancelPayment.mockResolvedValue({});

      await expect(service.processApproval('pk_regular', 'ORD-001', 50000)).rejects.toThrow(
        /일치하지 않아/
      );

      expect(mockTx.payments.update).not.toHaveBeenCalled();
      expect(ledgerService.recordIncome).not.toHaveBeenCalled();
      expect(TossAPI.cancelPayment).toHaveBeenCalledWith(
        'pk_regular',
        expect.stringContaining('불일치')
      );
    });

    test('[2차 방어] 자동 취소가 실패해도 예외는 그대로 전파된다', async () => {
      prisma.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      prisma.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      TossAPI.confirmPayment.mockResolvedValue({
        paymentKey: 'pk_regular',
        method: 'CARD',
        totalAmount: 1000,
        card: {},
        receipt: {},
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      mockTx.payments.findFirst.mockResolvedValue({
        id: 10,
        order_id: 1,
        status: 'READY',
        amount: 50000,
      });
      TossAPI.cancelPayment.mockRejectedValue(new Error('PG down'));

      await expect(service.processApproval('pk_regular', 'ORD-001', 50000)).rejects.toThrow(
        AppError
      );
      expect(mockTx.payments.update).not.toHaveBeenCalled();
    });

    test('READY 레코드가 없으면 1차 방어를 통과하고 기존 멱등 흐름을 탄다', async () => {
      prisma.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      prisma.payments.findFirst.mockResolvedValue(null); // READY 없음
      TossAPI.confirmPayment.mockResolvedValue({
        paymentKey: 'pk_dup',
        method: 'CARD',
        totalAmount: 50000,
        card: {},
        receipt: {},
      });
      mockTx.orders.findUnique.mockResolvedValue({
        id: 1,
        store_id: 1,
        order_number: 'ORD-001',
        total_amount: 50000,
      });
      mockTx.payments.findFirst
        .mockResolvedValueOnce(null) // READY 조회
        .mockResolvedValueOnce({ id: 9, status: 'DONE', payment_key: 'pk_dup' }); // DONE 조회

      const result = await service.processApproval('pk_dup', 'ORD-001', 50000);
      expect(result.message).toBe('이미 처리된 결제');
    });
  });

  // ─────────────────────────────────────────────────────────
  // confirmStoreCard & confirmTransfer
  // ─────────────────────────────────────────────────────────
  describe('confirmStoreCard', () => {
    test('confirms store card with transaction array', async () => {
      prisma.orders.findUnique.mockResolvedValue({
        id: 5,
        store_id: 1,
        payment_status: 'pending',
        total_amount: 20000,
        order_number: 'ORD-005',
      });

      const result = await service.confirmStoreCard(5, 'T12345');

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual({ store_id: 1, order_id: 5 });
    });

    test('returns alreadyPaid when order already paid', async () => {
      prisma.orders.findUnique.mockResolvedValue({ id: 5, payment_status: 'paid' });
      const result = await service.confirmStoreCard(5, 'T12345');
      expect(result).toEqual({ alreadyPaid: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('confirmTransfer', () => {
    test('confirms transfer payment', async () => {
      prisma.orders.findUnique.mockResolvedValue({
        id: 7,
        store_id: 2,
        payment_status: 'pending',
        total_amount: 50000,
        order_number: 'ORD-007',
      });

      const result = await service.confirmTransfer(7, 'REF001', '김철수');

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual({ store_id: 2, order_id: 7 });
    });
  });
});

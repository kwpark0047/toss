const express = require('express');
// 결제 라우트의 인증·capability·멱등키 경계만 검증한다. 토스 승인/취소 로직은
// PaymentService 단위 테스트와 PostgreSQL 금융 회귀 테스트가 담당한다.
jest.mock('../../services/AuthSessionService', () => ({
  verifyAccess: jest.fn(async (decoded) => decoded),
}));
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'payments-route-test-secret';

const mockPrisma = {
  payments: { findUnique: jest.fn() },
  idempotencyRecord: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('../../config/prisma', () => mockPrisma);

const ok = (_req, res) => res.json({ success: true });
const mockController = {
  createPayment: jest.fn(ok),
  confirmCash: jest.fn(ok),
  preparePayment: jest.fn(ok),
  confirmPayment: jest.fn(ok),
  getBrandPayConfig: jest.fn(ok),
  cancelByOrderId: jest.fn(ok),
  partialCancel: jest.fn(ok),
  cancelByPaymentKey: jest.fn(ok),
  uploadProof: jest.fn(ok),
  getProof: jest.fn(ok),
  setupSplitPayment: jest.fn(ok),
  getSplitStatus: jest.fn(ok),
  paySplit: jest.fn(ok),
  handleTossWebhook: jest.fn(ok),
  confirmStoreCard: jest.fn(ok),
  confirmTransfer: jest.fn(ok),
};
jest.mock('../../controllers/paymentController', () => mockController);

const router = require('../../routes/payments');
const { createOrderCapability } = require('../../utils/orderCapability');

const tokenFor = (id, role) => jwt.sign({ id, role, type: 'access' }, process.env.JWT_SECRET);
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', router);
  app.use((err, _req, res, _next) =>
    res.status(err.statusCode || err.status || 500).json({ error: err.message })
  );
  return app;
};

describe('payments routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.payments.findUnique.mockResolvedValue({ order_id: 10 });
  });

  describe('POST /api/payments/ready (결제 준비)', () => {
    it('해당 주문 capability 가 있으면 통과한다', async () => {
      const res = await request(buildApp())
        .post('/api/payments/ready')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .send({ order_id: 10 });
      expect(res.status).toBe(200);
      expect(mockController.preparePayment).toHaveBeenCalledTimes(1);
    });

    it('capability 없이 요청하면 403', async () => {
      const res = await request(buildApp()).post('/api/payments/ready').send({ order_id: 10 });
      expect(res.status).toBe(403);
      expect(mockController.preparePayment).not.toHaveBeenCalled();
    });

    it('다른 주문의 capability 로는 결제를 준비할 수 없다', async () => {
      const res = await request(buildApp())
        .post('/api/payments/ready')
        .set('x-order-capability', createOrderCapability({ id: 11, store_id: 3 }))
        .send({ order_id: 10 });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/payments/:paymentId/confirm (결제 승인)', () => {
    it('결제가 capability 의 주문에 속하면 승인으로 전달된다', async () => {
      const res = await request(buildApp())
        .post('/api/payments/55/confirm')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .send({ paymentKey: 'pk_test', amount: 12000 });
      expect(res.status).toBe(200);
      expect(mockPrisma.payments.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 55 } })
      );
      expect(mockController.confirmPayment).toHaveBeenCalledTimes(1);
    });

    it('다른 주문의 결제는 승인할 수 없다', async () => {
      mockPrisma.payments.findUnique.mockResolvedValue({ order_id: 99 });
      const res = await request(buildApp())
        .post('/api/payments/55/confirm')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .send({ paymentKey: 'pk_test', amount: 12000 });
      expect(res.status).toBe(403);
      expect(mockController.confirmPayment).not.toHaveBeenCalled();
    });

    it('capability 없이 승인하면 403', async () => {
      const res = await request(buildApp()).post('/api/payments/55/confirm').send({});
      expect(res.status).toBe(403);
    });
  });

  describe('관리자 결제 조작', () => {
    it('주문 취소는 로그인이 필요하다', async () => {
      const res = await request(buildApp()).post('/api/payments/order/10/cancel').send({});
      expect(res.status).toBe(401);
      expect(mockController.cancelByOrderId).not.toHaveBeenCalled();
    });

    it('로그인 사용자의 주문 취소는 컨트롤러(매장 권한 검사)로 전달된다', async () => {
      const res = await request(buildApp())
        .post('/api/payments/order/10/cancel')
        .set('Authorization', `Bearer ${tokenFor(99, 'owner')}`)
        .send({ cancelReason: '고객 요청' });
      expect(res.status).toBe(200);
      expect(mockController.cancelByOrderId).toHaveBeenCalledTimes(1);
    });

    it('현금 결제 확인은 Idempotency-Key 가 없으면 400', async () => {
      const res = await request(buildApp())
        .post('/api/payments/order/10/confirm-cash')
        .set('Authorization', `Bearer ${tokenFor(99, 'owner')}`)
        .send({});
      expect(res.status).toBe(400);
      expect(mockController.confirmCash).not.toHaveBeenCalled();
    });

    it('부분 취소는 로그인 없이 거부된다', async () => {
      const res = await request(buildApp())
        .post('/api/payments/order/10/partial-cancel')
        .set('Idempotency-Key', 'k-1')
        .send({ cancelAmount: 1000 });
      expect(res.status).toBe(401);
      expect(mockController.partialCancel).not.toHaveBeenCalled();
    });

    it('부분 취소는 Idempotency-Key 가 없으면 400', async () => {
      const res = await request(buildApp())
        .post('/api/payments/order/10/partial-cancel')
        .set('Authorization', `Bearer ${tokenFor(99, 'owner')}`)
        .send({ cancelAmount: 1000 });
      expect(res.status).toBe(400);
      expect(mockController.partialCancel).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/payments (결제 생성)', () => {
    it('주문 capability 와 멱등키가 있으면 전달된다', async () => {
      mockPrisma.idempotencyRecord.create.mockResolvedValue({});
      const res = await request(buildApp())
        .post('/api/payments')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .set('Idempotency-Key', 'create-1')
        .send({ order_id: 10, payment_method: 'card' });
      expect(res.status).toBe(200);
      expect(mockController.createPayment).toHaveBeenCalledTimes(1);
    });

    it('멱등키가 없으면 400', async () => {
      const res = await request(buildApp())
        .post('/api/payments')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .send({ order_id: 10, payment_method: 'card' });
      expect(res.status).toBe(400);
      expect(mockController.createPayment).not.toHaveBeenCalled();
    });

    it('포인트 결제는 지갑 소유권 확인 없이 거부된다', async () => {
      const res = await request(buildApp())
        .post('/api/payments')
        .set('x-order-capability', createOrderCapability({ id: 10, store_id: 3 }))
        .set('Idempotency-Key', 'create-2')
        .send({ order_id: 10, store_id: 3, payment_method: 'point' });
      expect(res.status).toBe(403);
      expect(mockController.createPayment).not.toHaveBeenCalled();
    });
  });
});

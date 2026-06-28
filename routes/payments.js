const express = require('express');
const prisma = require('../config/prisma');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');
const PaymentService = require('../services/PaymentService');
const Point = require('../models/Point');
const Ledger = require('../models/Ledger');
const catchAsync = require('../utils/catchAsync');
// const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth'); // 현재 미사용으로 주석 처리

// [업로드 설정] 계좌이체 증빙 이미지 저장소 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/proofs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${req.params.paymentId}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

/**
 * [결제 및 주문 통합 라우터]
 * 주문 생성, 결제 준비, 승인, 취소 등 결제 관련 모든 프로세스를 처리합니다.
 */

/**
 * 1. [통합 결제 생성 - 주문 포함]
 * 고객이 메뉴를 선택하고 주문/결제를 요청할 때 호출됩니다.
 * 현장결제(CASH)나 포인트결제(POINT)의 경우 즉시 완료 처리를 수행합니다.
 */
router.post('/', catchAsync(async (req, res) => {
  const {
    store_id, items, total_amount, payment_method,
    point_amount = 0, phone, toss_user_key, customer_name
  } = req.body;
    const io = req.app.get('io');

    // 1. 주문(Order) 먼저 생성 - 상태는 'pending'으로 시작
    const order = await Order.create({
      store_id,
      items,
      total_amount,
      customer_phone: phone,
      toss_user_key,
      customer_name,
      payment_method: payment_method === 'mixed' ? 'card' : payment_method, // DB 호환성을 위해 'mixed' 처리
      status: 'pending'
    });

    // 2. 결제 기록(Payment) 생성
    // - 주문 이름을 첫 번째 상품 외 N건으로 설정
    const payment = await Payment.create({
      order_id: order.id,
      store_id,
      order_name: items.length > 1 ? `${items[0].product_name} 외 ${items.length - 1}건` : items[0].product_name,
      amount: total_amount,
      method: payment_method.toUpperCase(),
      status: (payment_method === 'cash' || payment_method === 'point') ? 'DONE' : 'READY'
    });

    const logger = require('../utils/logger');
    // 3. 현장결제(CASH) 또는 포인트 전액 결제(POINT) 즉시 처리 로직
    logger.info(`결제 방식 확인: ${payment_method}`);
    if (payment_method === 'cash' || payment_method === 'point') {
      logger.info(`즉시 결제 처리 시작: order=${order.id}`);
      // 3-1. 포인트 사용 처리 (복합 결제 또는 포인트 결제 시)
      if (point_amount > 0) {
    await Point.use({
      identifier: { phone, toss_user_key },
      store_id,
      order_id: order.id,
      payment_id: payment.id,
      amount: point_amount,
      description: `주문(#${order.order_number}) 포인트 사용`
    });
      }

      // 3-2. 포인트 적립 처리 (매장 정책에 따라 계산된 포인트 적립)
      const earnPoints = await Point.calculateEarnPoints(total_amount, store_id);
      if (earnPoints > 0) {
    await Point.earn({
      identifier: { phone, toss_user_key },
      store_id,
      order_id: order.id,
      payment_id: payment.id,
      amount: earnPoints,
      description: `주문(#${order.order_number}) 적립`
    });
      }

      // 3-3. 통합 장부(Ledger) 기록 - 수입으로 기록
      Ledger.add({
    store_id,
    order_id: order.id,
    payment_id: payment.id,
    type: 'INCOME',
    category: 'SALE',
    amount: total_amount,
    method: payment_method.toUpperCase(),
    description: `결제 완료: ${order.order_number}`
      });

      // 3-4. 주문 상태 업데이트 - 결제 수단 기록 및 상태 'paid' 변경
      logger.info('주문 상태 업데이트 시도 (updatePayment & updateStatus)');
      await Order.updatePayment(order.id, payment_method.toUpperCase(), 'paid');
      await Order.updateStatus(order.id, 'paid');
      logger.info(`주문 상태 업데이트 완료: order=${order.id}`);

      // 3-5. [단골고객 업데이트] 현장/포인트 결제 완료 시 단골 리스트 기록
      const StoreCustomer = require('../models/StoreCustomer');
      await StoreCustomer.upsertCustomer({
    store_id,
    customer_phone: phone,
    customer_name,
    toss_user_key,
    amount: total_amount
      });

      // 3-6. 매장 관리자에게 실시간 알림 전송 (Socket.IO)
      if (io) {
    io.to(`store - ${store_id}`).emit('new-order', order);
    io.to(`store - ${store_id}`).emit('payment-success', {
      order_id: order.id,
      order_number: order.order_number,
      amount: total_amount
    });
      }
    }

    res.success({ ...payment, order_number: order.order_number, order_id: order.id }, '결제가 처리되었습니다');
}));

/**
 * 2. [결제 준비]
 * 외부 결제 서비스(토스페이먼츠 등) 연동 전에 결제 상태를 READY로 생성합니다.
 */
router.post('/ready', catchAsync(async (req, res) => {
  const { order_id, store_id, order_name, amount, method, checkout_url } = req.body;
    let targetStoreId = store_id;
    let targetAmount = amount;

    // 필수 정보가 누락된 경우 주문 정보에서 역추적
    if ((!targetStoreId || !targetAmount) && order_id) {
      const order = await Order.findById(parseInt(order_id));
      if (order) {
        if (!targetStoreId) targetStoreId = order.store_id;
        if (!targetAmount) targetAmount = order.total_amount;
      }
    }

    if (!targetStoreId) {
      return res.status(400).json({ error: 'store_id가 필요합니다.' });
    }
    if (!targetAmount) {
      return res.status(400).json({ error: 'amount가 필요합니다.' });
    }

    const payment = await Payment.create({
      order_id,
      store_id: targetStoreId,
      order_name: order_name || `주문 #${order_id}`,
      amount: targetAmount,
      method: method || 'CARD',
      status: 'READY',
      checkout_url
    });

    res.json({ success: true, paymentId: payment.id });
}));

/**
 * 3. [결제 승인 확인]
 * 외부 결제창에서 결제 완료 후 돌아온 승인 정보를 처리합니다.
 */
router.post('/:orderId/confirm', catchAsync(async (req, res) => {
  const { paymentKey, orderId: tossOrderId, amount, customerKey } = req.body;
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);

    // PaymentService를 통해 상세 승인 로직 수행 (상태값 변경, 포인트 적립 등 포함)
    const result = await paymentService.processApproval(paymentKey, tossOrderId, amount, customerKey);

    res.json(result);
}));

/**
 * 3-1. [브랜드페이 연동 정보 조회]
 * 프론트엔드에서 브랜드페이 위젯 초기화 시 필요한 customerKey 등을 발급합니다.
 */
router.get('/brandpay/config', authMiddleware, catchAsync(async (req, res) => {
    const crypto = require('crypto');
    // 사용자의 고유 식별자(전화번호 등)를 해싱하여 customerKey 생성
    const customerKey = crypto.createHash('sha256').update(req.user.id.toString()).digest('hex');

    res.success({
      customerKey,
      clientKey: process.env.TOSS_CLIENT_KEY || 'test_ck_D54YPdW9w8NE198759v8Vj7ByY6f'
    });
}));

/**
 * 4. [주문 ID 기반 결제 취소]
 * 관리자가 특정 주문을 취소할 때 사용됩니다.
 */
router.post('/order/:orderId/cancel', authMiddleware, catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const { cancelReason } = req.body;

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);

    // PaymentService를 통해 취소 및 포인트 회수 처리
    const result = await paymentService.processCancellation(orderId, cancelReason, req.user);

    res.json(result);
}));

/**
 * 5. [결제키 기반 취소 (하위 호환)]
 */
router.post('/:paymentKey/cancel', authMiddleware, catchAsync(async (req, res) => {
    const { paymentKey } = req.params;
    const { cancelReason } = req.body;

    const payment = await Payment.findByPaymentKey(paymentKey);
    if (!payment) return res.status(404).json({ error: '결제 정보 없음' });

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);

    const result = await paymentService.processCancellation(payment.order_id, cancelReason, req.user);

    res.json(result);
}));

/**
 * 6. [계좌이체 증빙 업로드]
 * 고객이 송금 확인증 사진을 업로드할 때 호출됩니다.
 */
router.post('/:paymentId/proof', upload.single('proof'), catchAsync(async (req, res) => {
  const { paymentId } = req.params;
    if (!req.file) throw new Error('업로드된 파일이 없습니다.');

    const proofUrl = `/uploads/proofs/${req.file.filename}`;

    // DB 업데이트
    await prisma.payments.update({
      where: { id: parseInt(paymentId) },
      data: {
    proof_image_url: proofUrl,
    updated_at: new Date()
      }
    });

    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('결제 정보를 찾을 수 없습니다.');

    // 매장 관리자에게 실시간 알림
    const io = req.app.get('io');
    if (io) {
      io.to(`store - ${payment.store_id}`).emit('payment-proof-uploaded', {
    payment_id: paymentId,
    order_id: payment.order_id,
    proof_url: proofUrl,
    timestamp: new Date().toISOString()
      });
    }

    res.success({ proof_url: proofUrl }, '입금 증빙이 업로드되었습니다.');
}));

/**
 * 7. [분할 결제 요청 설정]
 * 주문에 대해 분할 결제 방식(N분의 1, 품목별)을 설정합니다.
 */
router.post('/split/request', catchAsync(async (req, res) => {
  const { order_id, split_type, num_people } = req.body;
    const order = await prisma.orders.findUnique({
      where: { id: parseInt(order_id) },
      include: { order_items: true }
    });

    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });

    const splitData = {
      order_id: order.id,
      total_amount: order.total_amount,
      split_type, // EQUAL, ITEM
      items: []
    };

    if (split_type === 'EQUAL') {
      // N분의 1 계산
      const amountPerPerson = Math.floor(order.total_amount / num_people);
      const lastPersonExtra = order.total_amount % num_people;
      
      for (let i = 0; i < num_people; i++) {
    splitData.items.push({
      index: i + 1,
      amount: i === num_people - 1 ? amountPerPerson + lastPersonExtra : amountPerPerson,
      status: 'PENDING'
    });
      }
    } else if (split_type === 'ITEM') {
      // 품목별 계산 (order_items의 user_phone 기반으로 그룹화할 수도 있으나 기본은 품목 리스트 제공)
      splitData.items = order.order_items.map(item => ({
    id: item.id,
    name: item.product_name,
    amount: item.subtotal,
    status: 'PENDING'
      }));
    }

    // 주문 마스터 정보 업데이트
    await prisma.orders.update({
      where: { id: order.id },
      data: {
    is_split_payment: true,
    split_type: split_type,
    split_status: 'PENDING'
      }
    });

    res.success(splitData, '분할 결제 정보가 설정되었습니다.');
}));

/**
 * 8. [분할 결제 진행 상태 조회]
 * 특정 주문의 결제 현황(남은 금액, 참여 인원 등)을 조회합니다.
 */
router.get('/split/:orderId/status', catchAsync(async (req, res) => {
  const { orderId } = req.params;
    const order = await prisma.orders.findUnique({
      where: { id: parseInt(orderId) },
      include: {
    payments: {
      where: { status: 'DONE' },
      select: { amount: true, payer_phone: true, method: true, approved_at: true }
    }
      }
    });

    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });

    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, order.total_amount - totalPaid);

    res.success({
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      total_paid: totalPaid,
      remaining_amount: remaining,
      is_completed: remaining === 0,
      payments: order.payments
    }, '분할 결제 상태를 조회했습니다.');
}));

/**
 * 9. [분할 결제 — 내 몫 결제]
 * 분할 결제 주문에서 개인이 자신의 몫을 결제합니다.
 * POST /api/payments/split/pay
 * Body: { order_id, amount, payer_phone, split_type, payment_method }
 */
router.post('/split/pay', catchAsync(async (req, res) => {
  const { order_id, amount, payer_phone, split_type: _split_type, payment_method } = req.body;
    const io = req.app.get('io');

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.orders.findUnique({
    where: { id: parseInt(order_id) },
    include: { order_items: true }
      });
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      // 2. 부분 결제 레코드 생성
      const payment = await tx.payments.create({
    data: {
      order_id: order.id,
      store_id: order.store_id,
      order_name: `분할결제 #${order.order_number}`,
      amount: parseInt(amount),
      method: (payment_method || 'CARD').toUpperCase(),
      status: 'DONE',
      payer_phone: payer_phone || null,
      is_partial: true,
      created_at: new Date(),
      updated_at: new Date(),
      approved_at: new Date()
    }
      });

      // 3. 장부 기록
      await tx.ledger.create({
    data: {
      store_id: order.store_id,
      order_id: order.id,
      payment_id: payment.id,
      type: 'INCOME',
      category: 'SALE',
      amount: parseInt(amount),
      method: (payment_method || 'CARD').toUpperCase(),
      description: `분할결제: #${order.order_number} (${payer_phone || '익명'})`
    }
      });

      // 4. 분할 정산 상태 업데이트
      const donePayments = await tx.payments.findMany({
    where: { order_id: order.id, status: 'DONE' },
    select: { amount: true }
      });
      const totalPaid = donePayments.reduce((s, p) => s + p.amount, 0);
      const isFullyPaid = totalPaid >= order.total_amount;

      await tx.orders.update({
    where: { id: order.id },
    data: {
      payment_status: isFullyPaid ? 'paid' : 'partial',
      split_status: isFullyPaid ? 'COMPLETED' : 'PARTIAL',
      status: isFullyPaid ? 'paid' : undefined,
      updated_at: new Date()
    }
      });

      // 5. 단골 고객 업데이트
      if (payer_phone) {
    await tx.store_customers.upsert({
      where: {
    uk_store_customer: { store_id: order.store_id, customer_phone: payer_phone }
      },
      update: {
    visit_count: { increment: 1 },
    total_spent: { increment: parseInt(amount) },
    last_visit_at: new Date()
      },
      create: {
    store_id: order.store_id,
    customer_phone: payer_phone,
    customer_name: payer_phone,
    visit_count: 1,
    total_spent: parseInt(amount),
    tier: 'GENERAL'
      }
    });
      }

      return { payment, order, totalPaid, isFullyPaid };
    });
    // 6. Socket.io 실시간 알림
    if (io) {
      const tableId = txResult.order.table_id;
      if (tableId) {
    io.to(`table - ${tableId}`).emit('split-payment-update', {
      orderId: txResult.order.id,
      totalAmount: txResult.order.total_amount,
      paidAmount: txResult.totalPaid,
      remainingAmount: Math.max(0, txResult.order.total_amount - txResult.totalPaid),
      status: txResult.isFullyPaid ? 'COMPLETED' : 'PARTIAL',
      payer: payer_phone || 'anonymous'
    });
      }
      if (txResult.isFullyPaid) {
    io.to(`store - ${txResult.order.store_id}`).emit('new-order', txResult.order);
      }
    }

    res.success({
      payment: txResult.payment,
      order_id: txResult.order.id,
      order_number: txResult.order.order_number,
      total_paid: txResult.totalPaid,
      is_fully_paid: txResult.isFullyPaid,
      message: txResult.isFullyPaid ? '분할 결제가 모두 완료되었습니다.' : `분할 결제 중 — ${txResult.totalPaid.toLocaleString()}원 / ${txResult.order.total_amount.toLocaleString()}원`
    }, '분할 결제가 처리되었습니다.');
}));

module.exports = router;

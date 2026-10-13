const crypto = require('crypto');
const prisma = require('../config/prisma');
const Payment = require('../repositories/Payment');
const Order = require('../repositories/Order');
const PaymentService = require('../services/PaymentService');
const TossAPI = require('../utils/toss');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getStoreRole, rolePermissions } = require('../middleware/storeAuth');

const maskPaymentKey = (paymentKey) => {
  if (typeof paymentKey !== 'string' || paymentKey.length <= 8) return '****';
  return `****${paymentKey.slice(-8)}`;
};

const assertStoreAccess = async (user, storeId, permission = 'payments:manage') => {
  if (user.role === 'super_admin') return;
  const role = await getStoreRole(user.id, storeId);
  if (!role || (role !== 'owner' && !rolePermissions[role]?.includes(permission))) {
    const err = new Error('해당 매장에 대한 권한이 없습니다.');
    err.statusCode = 403;
    throw err;
  }
};

const paymentController = {
  createPayment: catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processDirectPayment(req.body, req.paymentIdentity);
    res.success(result, '결제가 처리되었습니다.');
  }),

  preparePayment: catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.preparePayment(req.body);
    res.json({ success: true, ...result });
  }),

  confirmCash: catchAsync(async (req, res) => {
    const orderId = Number(req.params.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0)
      throw new AppError('유효한 주문 ID가 필요합니다.', 400);
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: { store_id: true },
    });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    await assertStoreAccess(req.user, order.store_id, 'payments:collect');
    const result = await new PaymentService(req.app.get('io')).confirmOfflinePayment(
      orderId,
      'CASH'
    );
    res.success(result, '현금 수납이 확인되었습니다.');
  }),

  confirmPayment: catchAsync(async (req, res) => {
    const { paymentKey, orderId: tossOrderId, amount, customerKey } = req.body;
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processApproval(
      paymentKey,
      tossOrderId,
      amount,
      customerKey,
      req.params.orderId
    );
    res.json(result);
  }),

  getBrandPayConfig: catchAsync(async (req, res) => {
    const customerKey = crypto.createHash('sha256').update(req.user.id.toString()).digest('hex');
    const clientKey = process.env.TOSS_CLIENT_KEY;
    if (!clientKey) {
      // 테스트 키로의 fallback 없이 명시적으로 차단 (fail-closed)
      throw new AppError('Toss 결제 연동이 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503);
    }
    res.success({ customerKey, clientKey });
  }),

  cancelByOrderId: catchAsync(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      throw new AppError('올바르지 않은 주문 ID 형식입니다.', 400);
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: { store_id: true },
    });

    if (!order) {
      throw new AppError('취소할 주문을 찾을 수 없습니다.', 404);
    }

    // 멀티테넌트 로우 레벨 격리: 세션 사용자의 주문 취소 권한 검사
    await assertStoreAccess(req.user, order.store_id, 'payments:manage');

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processCancellation(
      orderId,
      req.body.cancelReason,
      req.body.manual_refund_confirmed
    );
    res.json(result);
  }),

  partialCancel: catchAsync(async (req, res) => {
    const { cancelAmount, cancelReason } = req.body;
    const order = await Order.findById(Number(req.params.orderId));
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    // Authorize against the immutable order tenant, even after its payment is canceled.
    // The durable refund intent decides whether this is a replay or a new refund.
    await assertStoreAccess(req.user, order.store_id, 'payments:manage');

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processPartialCancel(
      req.params.orderId,
      cancelAmount,
      cancelReason,
      req.get('Idempotency-Key') || req.get('X-Idempotency-Key')
    );
    res.json({
      success: true,
      message: `${Number(cancelAmount).toLocaleString()}원 부분 환불이 완료되었습니다.`,
      ...result,
    });
  }),

  cancelByPaymentKey: catchAsync(async (req, res) => {
    const payment = await Payment.findByPaymentKey(req.params.paymentKey);
    if (!payment) return res.status(404).json({ error: '결제 정보 없음' });

    // 멀티테넌트 로우 레벨 격리: 세션 사용자의 주문 취소 권한 검사
    await assertStoreAccess(req.user, payment.store_id, 'payments:manage');

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processCancellation(
      payment.order_id,
      req.body.cancelReason,
      req.body.manual_refund_confirmed
    );
    res.json(result);
  }),

  uploadProof: catchAsync(async (req, res) => {
    if (!req.file) throw new Error('업로드된 파일이 없습니다.');
    const proofKey = await require('../utils/privateProofStorage').save(req.file.buffer);
    const proofUrl = `private:${proofKey}`;
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    await paymentService.processProofUpload(req.params.paymentId, proofUrl);
    res.success(
      { proof_url: `/api/payments/${req.params.paymentId}/proof` },
      '입금 증빙이 업로드되었습니다.'
    );
  }),

  getProof: catchAsync(async (req, res) => {
    const payment = await prisma.payments.findUnique({
      where: { id: Number(req.params.paymentId) },
      select: { proof_image_url: true },
    });
    if (!payment?.proof_image_url?.startsWith('private:'))
      throw new AppError('증빙이 없거나 비공개 저장소로 이전이 필요합니다.', 404);
    const result = await require('../utils/privateProofStorage').access(
      payment.proof_image_url.slice(8)
    );
    res.set('Cache-Control', 'no-store');
    if (result.url) return res.success({ url: result.url, expires_in: 60 });
    return res.download(result.path, 'payment-proof');
  }),

  setupSplitPayment: catchAsync(async (req, res) => {
    const { order_id, split_type, num_people } = req.body;
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const splitData = await paymentService.setupSplitPayment(order_id, split_type, num_people);
    res.success(splitData, '분할 결제 정보가 설정되었습니다.');
  }),

  getSplitStatus: catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.getSplitStatus(req.params.orderId);
    res.success(result, '분할 결제 상태를 조회했습니다.');
  }),

  paySplit: catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.processSplitPayment(req.body);
    res.success(result, '분할 결제가 처리되었습니다.');
  }),

  handleTossWebhook: catchAsync(async (req, res) => {
    // Authentication/signature checks run on the route before durable receipt.
    const inbox = require('../services/PaymentWebhookInbox');
    const result = await inbox.run(req.body, (event) =>
      inbox.processEvent(event, req.app.get('io'))
    );
    res.status(200).json({ success: true, ...result });
  }),
  confirmStoreCard: catchAsync(async (req, res) => {
    const order = await Order.findById(parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
    await assertStoreAccess(req.user, order.store_id, 'payments:collect');

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.confirmStoreCard(
      req.params.orderId,
      req.body.terminal_receipt_no
    );
    if (result.alreadyPaid)
      return res.json({ success: true, message: '이미 결제 완료된 주문입니다.' });
    res.json({ success: true, message: '매장카드 결제가 확인되었습니다.' });
  }),

  confirmTransfer: catchAsync(async (req, res) => {
    const order = await Order.findById(parseInt(req.params.orderId));
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
    await assertStoreAccess(req.user, order.store_id, 'payments:collect');

    const io = req.app.get('io');
    const paymentService = new PaymentService(io);
    const result = await paymentService.confirmTransfer(
      req.params.orderId,
      req.body.transfer_reference,
      req.body.depositor_name
    );
    if (result.alreadyPaid) return res.json({ success: true, message: '이미 확인된 주문입니다.' });
    res.json({ success: true, message: '계좌이체 입금이 확인되었습니다.' });
  }),
};

module.exports = paymentController;

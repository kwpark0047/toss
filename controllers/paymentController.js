const crypto = require('crypto');
const prisma = require('../config/prisma');
const Payment = require('../repositories/Payment');
const Order = require('../repositories/Order');
const PaymentService = require('../services/PaymentService');
const Ledger = require('../repositories/Ledger');
const TossAPI = require('../utils/toss');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getStoreRole } = require('../middleware/storeAuth');

const assertStoreAccess = async (user, storeId, permission = 'orders:manage') => {
    if (user.role === 'super_admin') return;
    const role = await getStoreRole(user.id, storeId);
    const rolePermissions = {
        owner: ['store:update', 'store:delete', 'items:manage', 'orders:manage', 'staff:manage', 'stats:read', 'order:read'],
        manager: ['store:update', 'items:manage', 'orders:manage', 'staff:manage', 'stats:read', 'order:read'],
        staff: ['orders:manage', 'order:read'],
        kitchen: ['orders:manage', 'order:read']
    };
    if (!role || !rolePermissions[role]?.includes(permission)) {
        const err = new Error('해당 매장에 대한 권한이 없습니다.');
        err.statusCode = 403;
        throw err;
    }
};

const paymentController = {
    createPayment: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.processDirectPayment(req.body);
        res.success(result, '결제가 처리되었습니다.');
    }),

    preparePayment: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.preparePayment(req.body);
        res.json({ success: true, ...result });
    }),

    confirmPayment: catchAsync(async (req, res) => {
        const { paymentKey, orderId: tossOrderId, amount, customerKey } = req.body;
        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.processApproval(paymentKey, tossOrderId, amount, customerKey);
        res.json(result);
    }),

    getBrandPayConfig: catchAsync(async (req, res) => {
        const customerKey = crypto.createHash('sha256').update(req.user.id.toString()).digest('hex');
        res.success({
            customerKey,
            clientKey: process.env.TOSS_CLIENT_KEY || 'test_ck_D54YPdW9w8NE198759v8Vj7ByY6f'
        });
    }),

    cancelByOrderId: catchAsync(async (req, res) => {
        const orderId = parseInt(req.params.orderId);
        if (isNaN(orderId)) {
            throw new AppError('올바르지 않은 주문 ID 형식입니다.', 400);
        }

        const order = await prisma.orders.findUnique({
            where: { id: orderId },
            select: { store_id: true }
        });

        if (!order) {
            throw new AppError('취소할 주문을 찾을 수 없습니다.', 404);
        }

        // 멀티테넌트 로우 레벨 격리: 세션 사용자의 주문 취소 권한 검사
        await assertStoreAccess(req.user, order.store_id, 'orders:manage');

        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.processCancellation(orderId, req.body.cancelReason);
        res.json(result);
    }),

    partialCancel: catchAsync(async (req, res) => {
        const { cancelAmount, cancelReason } = req.body;

        const payments = await Payment.findByOrderId(req.params.orderId);
        const payment = payments.find(p => p.status === 'DONE');
        if (!payment) throw new AppError('취소 가능한 결제 내역이 없습니다.', 404);

        await assertStoreAccess(req.user, payment.store_id, 'orders:manage');

        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.processPartialCancel(req.params.orderId, cancelAmount, cancelReason);
        res.json({ success: true, message: `${Number(cancelAmount).toLocaleString()}원 부분 환불이 완료되었습니다.`, ...result });
    }),

    cancelByPaymentKey: catchAsync(async (req, res) => {
        const payment = await Payment.findByPaymentKey(req.params.paymentKey);
        if (!payment) return res.status(404).json({ error: '결제 정보 없음' });

        // 멀티테넌트 로우 레벨 격리: 세션 사용자의 주문 취소 권한 검사
        await assertStoreAccess(req.user, payment.store_id, 'orders:manage');

        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.processCancellation(payment.order_id, req.body.cancelReason);
        res.json(result);
    }),

    uploadProof: catchAsync(async (req, res) => {
        if (!req.file) throw new Error('업로드된 파일이 없습니다.');
        const proofUrl = `/uploads/proofs/${req.file.filename}`;
        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        await paymentService.processProofUpload(req.params.paymentId, proofUrl);
        res.success({ proof_url: proofUrl }, '입금 증빙이 업로드되었습니다.');
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
        const auth = req.headers['authorization'] || '';
        const expectedRaw = (process.env.TOSS_SECRET_KEY || '') + ':';
        const expected = 'Basic ' + Buffer.from(expectedRaw).toString('base64');
        const authBuf = Buffer.alloc(expected.length);
        const expectedBuf = Buffer.from(expected);
        authBuf.write(auth);
        if (!crypto.timingSafeEqual(authBuf, expectedBuf)) {
            logger.warn('[Webhook/Toss] 서명 검증 실패 - 요청 무시');
            return res.status(401).end();
        }

        logger.info(`[Webhook/Toss] 이벤트 수신: ${req.body?.eventType}`, { orderId: req.body?.data?.orderId });
        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        await paymentService.handleTossWebhook(req.body);
        res.status(200).json({ success: true });
    }),

    confirmStoreCard: catchAsync(async (req, res) => {
        const order = await Order.findById(parseInt(req.params.orderId));
        if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
        await assertStoreAccess(req.user, order.store_id, 'orders:manage');

        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.confirmStoreCard(req.params.orderId, req.body.terminal_receipt_no);
        if (result.alreadyPaid) return res.json({ success: true, message: '이미 결제 완료된 주문입니다.' });
        res.json({ success: true, message: '매장카드 결제가 확인되었습니다.' });
    }),

    confirmTransfer: catchAsync(async (req, res) => {
        const order = await Order.findById(parseInt(req.params.orderId));
        if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
        await assertStoreAccess(req.user, order.store_id, 'orders:manage');

        const io = req.app.get('io');
        const paymentService = new PaymentService(io);
        const result = await paymentService.confirmTransfer(req.params.orderId, req.body.transfer_reference, req.body.depositor_name);
        if (result.alreadyPaid) return res.json({ success: true, message: '이미 확인된 주문입니다.' });
        res.json({ success: true, message: '계좌이체 입금이 확인되었습니다.' });
    })
};

module.exports = paymentController;

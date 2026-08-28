const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const idempotency = require('../middleware/idempotency');
const orderCapability = require('../middleware/orderCapability');
const paymentOrderCapability = require('../middleware/paymentOrderCapability');
const tossWebhookAuth = require('../middleware/tossWebhookAuth');
const { paymentCapabilityOrStoreAuth } = paymentOrderCapability;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/proofs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${req.params.paymentId}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  },
});

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: 결제 처리 API (토스페이먼츠)
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     tags: [Payments]
 *     summary: 결제 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, amount]
 *             properties:
 *               orderId:
 *                 type: integer
 *               amount:
 *                 type: integer
 *               method:
 *                 type: string
 *     responses:
 *       200:
 *         description: 결제 정보
 */
router.post('/', idempotency({ namespace: 'payments:create' }), paymentController.createPayment);

/**
 * @swagger
 * /api/payments/ready:
 *   post:
 *     tags: [Payments]
 *     summary: 결제 준비 (토스 위젯 연동)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: integer
 *               amount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 결제 준비 정보
 */
router.post('/ready', orderCapability, paymentController.preparePayment);

/**
 * @swagger
 * /api/payments/{orderId}/confirm:
 *   post:
 *     tags: [Payments]
 *     summary: 결제 승인 확인
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentKey:
 *                 type: string
 *               amount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 결제 승인 완료
 */
router.post(
  '/:orderId/confirm',
  paymentOrderCapability,
  idempotency({ namespace: 'payments:confirm' }),
  paymentController.confirmPayment
);

/**
 * @swagger
 * /api/payments/brandpay/config:
 *   get:
 *     tags: [Payments]
 *     summary: 브랜드페이 설정 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 브랜드페이 설정
 */
router.get('/brandpay/config', authMiddleware, paymentController.getBrandPayConfig);

/**
 * @swagger
 * /api/payments/order/{orderId}/cancel:
 *   post:
 *     tags: [Payments]
 *     summary: 주문 전체 취소
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancelReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 취소 완료
 */
router.post('/order/:orderId/cancel', authMiddleware, paymentController.cancelByOrderId);

/**
 * @swagger
 * /api/payments/order/{orderId}/partial-cancel:
 *   post:
 *     tags: [Payments]
 *     summary: 주문 부분 취소
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cancelAmount]
 *             properties:
 *               cancelAmount:
 *                 type: integer
 *               cancelReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 부분 취소 완료
 */
router.post(
  '/order/:orderId/partial-cancel',
  authMiddleware,
  idempotency({ namespace: 'payments:partial-cancel', required: true }),
  paymentController.partialCancel
);

/**
 * @swagger
 * /api/payments/{paymentKey}/cancel:
 *   post:
 *     tags: [Payments]
 *     summary: 결제키 기반 취소
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentKey
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancelReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 취소 완료
 */
router.post('/:paymentKey/cancel', authMiddleware, paymentController.cancelByPaymentKey);

/**
 * @swagger
 * /api/payments/{paymentId}/proof:
 *   post:
 *     tags: [Payments]
 *     summary: 결제 영수증/증빙 이미지 업로드
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               proof:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드 완료
 */
router.post(
  '/:paymentId/proof',
  authMiddleware,
  paymentCapabilityOrStoreAuth,
  upload.single('proof'),
  paymentController.uploadProof
);

/**
 * @swagger
 * /api/payments/split/request:
 *   post:
 *     tags: [Payments]
 *     summary: 분할 결제 요청
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: integer
 *               splitCount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 분할 결제 설정
 */
router.post('/split/request', orderCapability, paymentController.setupSplitPayment);

/**
 * @swagger
 * /api/payments/split/{orderId}/status:
 *   get:
 *     tags: [Payments]
 *     summary: 분할 결제 상태 조회
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 분할 결제 상태
 */
router.get('/split/:orderId/status', orderCapability, paymentController.getSplitStatus);

/**
 * @swagger
 * /api/payments/split/pay:
 *   post:
 *     tags: [Payments]
 *     summary: 분할 결제 실행
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: integer
 *               splitIndex:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 분할 결제 완료
 */
router.post(
  '/split/pay',
  orderCapability,
  idempotency({ namespace: 'payments:split', required: true }),
  paymentController.paySplit
);

/**
 * @swagger
 * /api/payments/webhooks/toss:
 *   post:
 *     tags: [Payments]
 *     summary: 토스페이먼츠 웹훅 수신
 *     description: 계층적 검증(서명/공유 시크릿/IP 화이트리스트/레거시 Basic) 적용.
 *       지급대행/매장변경 이벤트는 HMAC-SHA256 서명 검증(tosspayments-webhook-signature).
 *       결제 웹훅은 공유 시크릿/IP 화이트리스트/레거시 Basic으로 검증.
 *     parameters:
 *       - in: header
 *         name: x-webhook-secret
 *         required: false
 *         schema: { type: string }
 *       - in: header
 *         name: tosspayments-webhook-signature
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: secret
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 웹훅 처리 완료
 *       401:
 *         description: 웹훅 검증 실패
 */
router.post(
  '/webhooks/toss',
  express.raw({ type: 'application/json' }),
  tossWebhookAuth,
  paymentController.handleTossWebhook
);

/**
 * @swagger
 * /api/payments/order/{orderId}/confirm-store-card:
 *   post:
 *     tags: [Payments]
 *     summary: 매장 카드 결제 승인
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 카드 결제 승인 완료
 */
router.post(
  '/order/:orderId/confirm-store-card',
  authMiddleware,
  paymentController.confirmStoreCard
);

/**
 * @swagger
 * /api/payments/order/{orderId}/confirm-transfer:
 *   post:
 *     tags: [Payments]
 *     summary: 계좌이체 확인
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 계좌이체 확인 완료
 */
router.post('/order/:orderId/confirm-transfer', authMiddleware, paymentController.confirmTransfer);

module.exports = router;

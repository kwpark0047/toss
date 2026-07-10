const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

router.post('/', paymentController.createPayment);
router.post('/ready', paymentController.preparePayment);
router.post('/:orderId/confirm', paymentController.confirmPayment);
router.get('/brandpay/config', authMiddleware, paymentController.getBrandPayConfig);
router.post('/order/:orderId/cancel', authMiddleware, paymentController.cancelByOrderId);
router.post('/order/:orderId/partial-cancel', authMiddleware, paymentController.partialCancel);
router.post('/:paymentKey/cancel', authMiddleware, paymentController.cancelByPaymentKey);
router.post('/:paymentId/proof', upload.single('proof'), paymentController.uploadProof);
router.post('/split/request', paymentController.setupSplitPayment);
router.get('/split/:orderId/status', paymentController.getSplitStatus);
router.post('/split/pay', paymentController.paySplit);
router.post('/webhooks/toss', paymentController.handleTossWebhook);
router.post('/order/:orderId/confirm-store-card', authMiddleware, paymentController.confirmStoreCard);
router.post('/order/:orderId/confirm-transfer', authMiddleware, paymentController.confirmTransfer);

module.exports = router;

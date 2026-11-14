const express = require('express');
const router = express.Router();
const aiOrderController = require('../controllers/aiOrderController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

/**
 * @swagger
 * tags:
 *   name: AI Order
 *   description: 자연어 음성 및 챗봇 오더 비서 API
 */

router.post('/parse', authMiddleware, aiOrderController.parseOrder);

// QR customers are anonymous. Keep this endpoint narrowly scoped, bounded,
// and rate limited; it only returns a validated cart draft and never creates an order.
router.post(
  '/public/parse',
  rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' },
  }),
  aiOrderController.parsePublicOrder
);

module.exports = router;

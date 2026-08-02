const express = require('express');
const router = express.Router();
const aiOrderController = require('../controllers/aiOrderController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: AI Order
 *   description: 자연어 음성 및 챗봇 오더 비서 API
 */

router.post('/parse', authMiddleware, aiOrderController.parseOrder);

module.exports = router;

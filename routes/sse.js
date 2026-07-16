const express = require('express');
const router = express.Router();
const sseController = require('../controllers/sseController');

// SSE 연결 수립
router.get('/order/:orderId', sseController.subscribeToOrder);

module.exports = router;

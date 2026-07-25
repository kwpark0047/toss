const express = require('express');
const router = express.Router();
const paymentController = require('./PaymentController');

router.post('/', paymentController.processPayment);
router.get('/store/:storeId', paymentController.getPaymentsByStore);
router.get('/store/:storeId/stats', paymentController.getPaymentStats);
router.get('/:id', paymentController.getPayment);
router.post('/:id/confirm', paymentController.confirmPayment);
router.post('/:id/cancel', paymentController.cancelPayment);

module.exports = router;

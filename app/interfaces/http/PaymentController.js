const ProcessPayment = require('../../application/payments/ProcessPayment');
const ConfirmPayment = require('../../application/payments/ConfirmPayment');
const CancelPayment = require('../../application/payments/CancelPayment');
const paymentRepository = require('../../infrastructure/prisma/PaymentRepository');
const orderRepository = require('../../infrastructure/prisma/OrderRepository');

class PaymentController {
  async processPayment(req, res) {
    try {
      const processPayment = new ProcessPayment(paymentRepository, orderRepository);
      const payment = await processPayment.execute(req.body);
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async confirmPayment(req, res) {
    try {
      const { id } = req.params;
      const { toss_payment_key, toss_transaction_id } = req.body;
      const confirmPayment = new ConfirmPayment(paymentRepository, orderRepository);
      const payment = await confirmPayment.execute(parseInt(id), toss_payment_key, toss_transaction_id);
      res.json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async cancelPayment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const cancelPayment = new CancelPayment(paymentRepository, orderRepository);
      const payment = await cancelPayment.execute(parseInt(id), reason);
      res.json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentRepository.findById(parseInt(id));
      if (!payment) {
        return res.status(404).json({ success: false, message: '결제를 찾을 수 없습니다.' });
      }
      res.json({ success: true, data: payment });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPaymentsByStore(req, res) {
    try {
      const { storeId } = req.params;
      const { status, start_date, end_date, page, limit } = req.query;
      const result = await paymentRepository.findByStoreId(parseInt(storeId), {
        status,
        start_date,
        end_date,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPaymentStats(req, res) {
    try {
      const { storeId } = req.params;
      const { start_date, end_date } = req.query;
      const stats = await paymentRepository.getStats(parseInt(storeId), start_date, end_date);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new PaymentController();

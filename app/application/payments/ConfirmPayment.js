class ConfirmPayment {
  constructor(paymentRepository, orderRepository) {
    this.paymentRepository = paymentRepository;
    this.orderRepository = orderRepository;
  }

  async execute(paymentId, tossPaymentKey, tossTransactionId) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('결제를 찾을 수 없습니다.');
    }

    if (payment.status !== 'pending') {
      throw new Error('대기 중인 결제만 승인할 수 있습니다.');
    }

    const updated = await this.paymentRepository.updateStatus(paymentId, 'approved');

    await this.paymentRepository.update(paymentId, {
      toss_payment_key: tossPaymentKey,
      toss_transaction_id: tossTransactionId,
      paid_at: new Date()
    });

    await this.orderRepository.updateStatus(payment.order_id, 'confirmed');

    return updated;
  }
}

module.exports = ConfirmPayment;

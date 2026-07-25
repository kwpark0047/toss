class CancelPayment {
  constructor(paymentRepository, orderRepository) {
    this.paymentRepository = paymentRepository;
    this.orderRepository = orderRepository;
  }

  async execute(paymentId, reason) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('결제를 찾을 수 없습니다.');
    }

    if (payment.status !== 'pending' && payment.status !== 'approved') {
      throw new Error('대기 중이거나 승인된 결제만 취소할 수 있습니다.');
    }

    const updated = await this.paymentRepository.updateStatus(paymentId, 'cancelled');

    await this.orderRepository.updateStatus(payment.order_id, 'cancelled');

    return updated;
  }
}

module.exports = CancelPayment;

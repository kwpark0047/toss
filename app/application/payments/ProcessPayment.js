class ProcessPayment {
  constructor(paymentRepository, orderRepository) {
    this.paymentRepository = paymentRepository;
    this.orderRepository = orderRepository;
  }

  async execute(paymentData) {
    const { order_id, store_id, method, amount, card_number, card_company } = paymentData;

    const order = await this.orderRepository.findById(order_id);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    if (order.store_id !== parseInt(store_id)) {
      throw new Error('주문과 매장이 일치하지 않습니다.');
    }

    const payment = await this.paymentRepository.create({
      order_id,
      store_id: parseInt(store_id),
      order_number: order.order_number,
      method,
      amount,
      card_number: card_number || null,
      card_company: card_company || null,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });

    return payment;
  }
}

module.exports = ProcessPayment;

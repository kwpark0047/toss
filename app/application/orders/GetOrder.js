class GetOrder {
  constructor(orderRepository) {
    this.orderRepository = orderRepository;
  }

  async execute(orderId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    return order;
  }

  async getByOrderNumber(orderNumber) {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    return order;
  }

  async getByStoreId(storeId, options = {}) {
    return await this.orderRepository.findByStoreId(storeId, options);
  }
}

module.exports = GetOrder;

class UpdateOrderStatus {
  constructor(orderRepository) {
    this.orderRepository = orderRepository;
  }

  async execute(orderId, status) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    if (!this._isValidStatusTransition(order.status, status)) {
      throw new Error(`상태 전환 불가: ${order.status} → ${status}`);
    }

    return await this.orderRepository.updateStatus(orderId, status);
  }

  _isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['completed'],
      'completed': [],
      'cancelled': []
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

module.exports = UpdateOrderStatus;

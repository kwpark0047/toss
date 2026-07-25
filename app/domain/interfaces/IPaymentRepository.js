class IPaymentRepository {
  async findById(id) {
    throw new Error('Not implemented');
  }

  async findByOrderId(orderId) {
    throw new Error('Not implemented');
  }

  async findByStoreId(storeId, options) {
    throw new Error('Not implemented');
  }

  async create(paymentData) {
    throw new Error('Not implemented');
  }

  async update(id, paymentData) {
    throw new Error('Not implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Not implemented');
  }

  async getStats(storeId, startDate, endDate) {
    throw new Error('Not implemented');
  }
}

module.exports = IPaymentRepository;

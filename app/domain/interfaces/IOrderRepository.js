class IOrderRepository {
  async findById(id) {
    throw new Error('Not implemented');
  }

  async findByOrderNumber(orderNumber) {
    throw new Error('Not implemented');
  }

  async findByStoreId(storeId, options) {
    throw new Error('Not implemented');
  }

  async create(orderData) {
    throw new Error('Not implemented');
  }

  async update(id, orderData) {
    throw new Error('Not implemented');
  }

  async updateStatus(id, status) {
    throw new Error('Not implemented');
  }

  async getStats(storeId, startDate, endDate) {
    throw new Error('Not implemented');
  }
}

module.exports = IOrderRepository;

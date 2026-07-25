class ICustomerRepository {
  async findById(storeId, customerId) { throw new Error('Not implemented'); }
  async findByPhone(storeId, phone) { throw new Error('Not implemented'); }
  async upsert(data) { throw new Error('Not implemented'); }
  async getStats(storeId) { throw new Error('Not implemented'); }
  async getHistory(storeId, customerId) { throw new Error('Not implemented'); }
  async findByStoreId(storeId, options) { throw new Error('Not implemented'); }
  async getNearbyStores(lat, lng) { throw new Error('Not implemented'); }
  async getCoupons(storeId) { throw new Error('Not implemented'); }
  async issueCoupon(customerPhone, couponId, expiresAt) { throw new Error('Not implemented'); }
  async registerFcmToken(storeId, phone, fcmToken) { throw new Error('Not implemented'); }
}

module.exports = ICustomerRepository;

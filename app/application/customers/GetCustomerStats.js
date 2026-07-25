class GetCustomerStats {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  async execute(storeId) {
    return await this.customerRepository.getStats(parseInt(storeId));
  }
}

module.exports = GetCustomerStats;

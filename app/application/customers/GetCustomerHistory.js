class GetCustomerHistory {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  async execute(storeId, customerId) {
    return await this.customerRepository.getHistory(parseInt(storeId), parseInt(customerId));
  }
}

module.exports = GetCustomerHistory;

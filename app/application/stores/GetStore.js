class GetStore {
  constructor(storeRepository) {
    this.storeRepository = storeRepository;
  }

  async execute(storeId) {
    const store = await this.storeRepository.findById(parseInt(String(storeId)));
    if (!store) {
      throw new Error('매장을 찾을 수 없습니다.');
    }
    return store;
  }
}

module.exports = GetStore;

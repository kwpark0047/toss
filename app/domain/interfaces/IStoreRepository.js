class IStoreRepository {
  async findById(id) {
    throw new Error('Not implemented');
  }

  async findByName(name) {
    throw new Error('Not implemented');
  }

  async findByUserId(userId) {
    throw new Error('Not implemented');
  }

  async create(storeData) {
    throw new Error('Not implemented');
  }

  async update(id, storeData) {
    throw new Error('Not implemented');
  }

  async delete(id) {
    throw new Error('Not implemented');
  }

  async search(options) {
    throw new Error('Not implemented');
  }

  async getStats(storeId) {
    throw new Error('Not implemented');
  }
}

module.exports = IStoreRepository;

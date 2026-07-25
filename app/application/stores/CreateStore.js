class CreateStore {
  constructor(storeRepository) {
    this.storeRepository = storeRepository;
  }

  async execute(storeData) {
    const { name, address, phone, business_number, userId } = storeData;

    if (!name || !name.trim()) {
      throw new Error('매장 이름은 필수입니다.');
    }

    const store = await this.storeRepository.create({
      name: name.trim(),
      address,
      phone,
      business_number,
      user_id: userId,
    });

    return store;
  }
}

module.exports = CreateStore;

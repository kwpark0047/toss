class SearchStores {
  constructor(storeRepository) {
    this.storeRepository = storeRepository;
  }

  async execute(options) {
    const { district, business_type, q, lat, lng, limit = 30, page = 1 } = options;

    const result = await this.storeRepository.search({
      district,
      business_type,
      q,
      lat,
      lng,
      limit: Math.min(parseInt(String(limit)) || 30, 100),
      page: Math.max(parseInt(String(page)) || 1, 1),
    });

    return result;
  }
}

module.exports = SearchStores;

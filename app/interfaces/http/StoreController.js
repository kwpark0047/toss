const SearchStores = require('../../application/stores/SearchStores');
const GetStore = require('../../application/stores/GetStore');
const CreateStore = require('../../application/stores/CreateStore');
const storeRepository = require('../../infrastructure/prisma/StoreRepository');

class StoreController {
  async searchStores(req, res) {
    try {
      const { district, business_type, q, lat, lng, limit, page } = req.query;
      const searchStores = new SearchStores(storeRepository);
      const result = await searchStores.execute({
        district, business_type, q,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
        limit, page,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStore(req, res) {
    try {
      const { id } = req.params;
      const getStore = new GetStore(storeRepository);
      const store = await getStore.execute(id);
      res.json({ success: true, data: store });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  async createStore(req, res) {
    try {
      const { name, address, phone, business_number } = req.body;
      const userId = req.user?.id;
      const createStore = new CreateStore(storeRepository);
      const store = await createStore.execute({
        name, address, phone, business_number, userId,
      });
      res.status(201).json({ success: true, data: store });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getPopular(req, res) {
    try {
      const stores = await storeRepository.getPopular();
      res.json({ success: true, data: stores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getHighlights(req, res) {
    try {
      const { district } = req.query;
      const stores = await storeRepository.getHighlights(district);
      res.json({ success: true, data: stores });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new StoreController();

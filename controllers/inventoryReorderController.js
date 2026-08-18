const InventoryReorderService = require('../services/InventoryReorderService');

const inventoryReorderController = {
  async generate(req, res) {
    const result = await InventoryReorderService.generateCandidates(req.params.storeId, req.body);
    res.success(result, '자동 발주 후보를 산출했습니다.');
  },

  async list(req, res) {
    const result = await InventoryReorderService.list(req.params.storeId, req.query.status);
    res.success(result);
  },

  async decide(req, res) {
    const result = await InventoryReorderService.decide(
      req.params.id,
      req.params.storeId,
      req.body.status,
      req.user.id
    );
    res.success(result, '발주 후보 처리가 완료되었습니다.');
  },
};

module.exports = inventoryReorderController;

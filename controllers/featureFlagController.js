const featureFlagService = require('../services/FeatureFlagService');

const featureFlagController = {
  async list(req, res) {
    const flags = await featureFlagService.list(req.query);
    res.success(flags);
  },

  async upsert(req, res) {
    const flag = await featureFlagService.upsert({ ...req.body, key: req.params.key });
    res.success(flag, 'Feature Flag가 저장되었습니다.');
  },

  async remove(req, res) {
    await featureFlagService.remove(req.params.key, req.query);
    res.success(null, 'Feature Flag가 삭제되었습니다.');
  },
};

module.exports = featureFlagController;

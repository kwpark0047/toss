const orderEventService = require('../services/OrderEventService');

const orderEventController = {
  async list(req, res) {
    const result = await orderEventService.list(req.query);
    res.success(result);
  },
};

module.exports = orderEventController;

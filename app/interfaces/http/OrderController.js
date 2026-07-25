const logger = require('../../../utils/logger');

class OrderController {
  constructor(createOrder, getOrder, updateOrderStatus) {
    this.createOrder = createOrder;
    this.getOrder = getOrder;
    this.updateOrderStatus = updateOrderStatus;
  }

  async create(req, res) {
    try {
      const order = await this.createOrder.execute(req.body);
      res.success(order, '주문이 생성되었습니다.');
    } catch (error) {
      logger.error('주문 생성 실패:', error.message);
      res.error(error.message, 400);
    }
  }

  async getById(req, res) {
    try {
      const order = await this.getOrder.execute(parseInt(req.params.id));
      res.success(order);
    } catch (error) {
      logger.error('주문 조회 실패:', error.message);
      res.error(error.message, 404);
    }
  }

  async getByOrderNumber(req, res) {
    try {
      const order = await this.getOrder.getByOrderNumber(req.params.orderNumber);
      res.success(order);
    } catch (error) {
      logger.error('주문 조회 실패:', error.message);
      res.error(error.message, 404);
    }
  }

  async listByStore(req, res) {
    try {
      const result = await this.getOrder.getByStoreId(parseInt(req.params.storeId), req.query);
      res.success(result);
    } catch (error) {
      logger.error('주문 목록 조회 실패:', error.message);
      res.error(error.message, 500);
    }
  }

  async updateStatus(req, res) {
    try {
      const order = await this.updateOrderStatus.execute(
        parseInt(req.params.id),
        req.body.status
      );
      res.success(order, '주문 상태가 업데이트되었습니다.');
    } catch (error) {
      logger.error('주문 상태 업데이트 실패:', error.message);
      res.error(error.message, 400);
    }
  }
}

module.exports = OrderController;

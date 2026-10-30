const { AppError } = require('../utils/errorHandler');
const purchaseService = require('../services/PurchaseService');

const list = async (req, res, next) => {
  try {
    const purchases = await purchaseService.list(req.params.storeId, req.query.status);
    res.success({ purchases }, '매입 발주 목록을 불러왔습니다.');
  } catch (error) {
    next(error);
  }
};

const createDraft = async (req, res, next) => {
  try {
    const purchase = await purchaseService.createDraft(req.params.storeId, req.body, req.user?.id);
    res.status(201).success({ purchase }, '발주 초안을 저장했습니다.');
  } catch (error) {
    next(error);
  }
};

const markOrdered = async (req, res, next) => {
  try {
    const purchase = await purchaseService.markOrdered(req.params.storeId, req.params.purchaseId);
    res.success({ purchase }, '발주 상태를 기록했습니다.');
  } catch (error) {
    next(error);
  }
};

const receive = async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key) throw new AppError('Idempotency-Key 헤더가 필요합니다.', 400);
    const receipt = await purchaseService.receive(
      req.params.storeId,
      req.params.purchaseId,
      req.body,
      req.user?.id,
      key
    );
    res.success({ receipt }, '입고와 재고 반영을 완료했습니다.');
  } catch (error) {
    next(error);
  }
};

module.exports = { list, createDraft, markOrdered, receive };

const billing = require('../services/SaaSBillingService');
const { AppError } = require('../utils/errorHandler');
module.exports = {
  async registerPaymentMethod(req, res, next) {
    try {
      if (!['owner', 'super_admin'].includes(req.storeRole))
        throw new AppError('구독 관리는 매장 소유자만 가능합니다.', 403);
      const result = await billing.activate(
        Number(req.storeId),
        req.user.id,
        req.body.auth_key,
        req.body.checkout_token
      );
      res.success(result, '구독 정보가 갱신되었습니다.');
    } catch (error) {
      next(error);
    }
  },
};

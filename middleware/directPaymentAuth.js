const { verifyWalletCapability } = require('../utils/orderCapability');
const { AppError } = require('../utils/errorHandler');
module.exports = (req, res, next) => {
  if (req.body.payment_method !== 'point') return next();
  if (req.user?.id) {
    req.paymentIdentity = { user_id: req.user.id };
    return next();
  }
  const wallet = verifyWalletCapability(req.get('x-wallet-capability'));
  if (!wallet || Number(wallet.store_id) !== Number(req.body.store_id) || !wallet.customer_phone) {
    return next(new AppError('해당 매장의 지갑 소유권 확인이 필요합니다.', 403));
  }
  req.paymentIdentity = { phone: wallet.customer_phone, toss_user_key: wallet.toss_user_key };
  return next();
};

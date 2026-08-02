const loyaltyService = require('../services/LoyaltyService');
const catchAsync = require('../utils/catchAsync');

const loyaltyController = {
  addStamps: catchAsync(async (req, res) => {
    const { store_id, customer_phone, earned_stamps } = req.body;
    const result = await loyaltyService.addStampsAndCheckTier(
      store_id,
      customer_phone,
      earned_stamps
    );
    res.success(result, '스탬프가 적립되었습니다.');
  }),

  redeem: catchAsync(async (req, res) => {
    const { store_id, customer_phone, required_stamps } = req.body;
    const result = await loyaltyService.redeemStampsForReward(
      store_id,
      customer_phone,
      required_stamps
    );
    res.success(result, '스탬프 교환이 완료되었습니다.');
  }),
};

module.exports = loyaltyController;

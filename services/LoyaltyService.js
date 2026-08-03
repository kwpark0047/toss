const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class LoyaltyService {
  /**
   * 고객의 스탬프 적립 및 등급(Tier) 자동 산정
   */
  async addStampsAndCheckTier(storeId, customerPhone, earnedStamps = 1) {
    if (!customerPhone) return null;

    return await prisma.$transaction(async (tx) => {
      // 1. 고객 loyalty 기록 조회 또는 생성
      let loyalty = await tx.store_customers.findFirst({
        where: { store_id: Number(storeId), phone: customerPhone },
      });

      if (!loyalty) {
        loyalty = await tx.store_customers.create({
          data: {
            store_id: Number(storeId),
            phone: customerPhone,
            stamp_count: 0,
            tier: 'BRONZE',
            total_spent: 0,
            visit_count: 0,
          },
        });
      }

      const newStamps = (loyalty.stamp_count || 0) + earnedStamps;
      const newVisits = (loyalty.visit_count || 0) + 1;

      // 등급 산정 기준 (스탬프 또는 방문 수 기반)
      let newTier = loyalty.tier || 'BRONZE';
      if (newStamps >= 30 || newVisits >= 25) {
        newTier = 'VIP';
      } else if (newStamps >= 20 || newVisits >= 15) {
        newTier = 'GOLD';
      } else if (newStamps >= 10 || newVisits >= 5) {
        newTier = 'SILVER';
      }

      const updated = await tx.store_customers.update({
        where: { id: loyalty.id },
        data: {
          stamp_count: newStamps,
          visit_count: newVisits,
          tier: newTier,
          updated_at: new Date(),
        },
      });

      logger.info(
        { storeId, customerPhone, newStamps, newTier },
        'Loyalty stamps added & tier checked'
      );
      return updated;
    });
  }

  /**
   * 스탬프 교환 쿠폰 발급 (예: 10개 적립 시 무료 아메리카노 쿠폰)
   */
  async redeemStampsForReward(storeId, customerPhone, requiredStamps = 10) {
    return await prisma.$transaction(async (tx) => {
      const loyalty = await tx.store_customers.findFirst({
        where: { store_id: Number(storeId), phone: customerPhone },
      });

      if (!loyalty || (loyalty.stamp_count || 0) < requiredStamps) {
        throw new AppError('스탬프가 부족합니다.', 400);
      }

      const remainingStamps = loyalty.stamp_count - requiredStamps;

      await tx.store_customers.update({
        where: { id: loyalty.id },
        data: { stamp_count: remainingStamps, updated_at: new Date() },
      });

      logger.info({ storeId, customerPhone, remainingStamps }, 'Stamps redeemed successfully');
      return { success: true, remainingStamps, message: '스탬프가 보상으로 교환되었습니다!' };
    });
  }
}

module.exports = new LoyaltyService();

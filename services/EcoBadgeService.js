const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class EcoBadgeService {
  /**
   * 친환경 주문(다회용기 사용, 모바일 영수증 전용)에 따른 탄소 절감량(g CO2) 산정 및 인증 뱃지 부여
   */
  async calculateEcoFootprint(storeId) {
    const numericStoreId = Number(storeId);

    // 친환경 옵션이 포함된 주문 수 집계 (예: take_out 이거나 notes에 다회용기 키워드 포함)
    const ecoOrdersCount = await prisma.orders.count({
      where: {
        store_id: numericStoreId,
        OR: [
          { notes: { contains: '다회용기' } },
          { notes: { contains: '텀블러' } },
          { notes: { contains: '종이영수증생략' } },
        ],
      },
    });

    // 주문당 평균 50g 탄소 절감 가정
    const carbonSavedGrams = ecoOrdersCount * 50;
    const carbonSavedKg = (carbonSavedGrams / 1000).toFixed(1);

    let badgeLevel = 'GREEN_BEGINNER';
    if (carbonSavedGrams >= 10000) badgeLevel = 'ECO_MASTER';
    else if (carbonSavedGrams >= 5000) badgeLevel = 'ECO_PRO';
    else if (carbonSavedGrams >= 1000) badgeLevel = 'ECO_FRIENDLY';

    logger.debug(
      { storeId: numericStoreId, ecoOrdersCount, carbonSavedKg, badgeLevel },
      'Eco badge calculated'
    );

    return {
      storeId: numericStoreId,
      ecoOrdersCount,
      carbonSavedKg: Number(carbonSavedKg),
      badgeLevel,
      badgeTitle:
        badgeLevel === 'ECO_MASTER'
          ? '에코 마스터 👑'
          : badgeLevel === 'ECO_PRO'
            ? '친환경 우수 매장 🌱'
            : '그린 파트너 🌿',
    };
  }
}

module.exports = new EcoBadgeService();

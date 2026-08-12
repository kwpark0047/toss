const EcoBadgeService = require('../services/EcoBadgeService');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

const ecoBadgeController = {
  /**
   * 매장 친환경 뱃지 조회 및 갱신
   */
  getEcoBadge: catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const service = new EcoBadgeService();
    const badge = await service.calculateEcoFootprint(storeId);

    // DB에 뱃지 정보 동기화 (필드 존재 시)
    try {
      await prisma.stores.update({
        where: { id: Number(storeId) },
        data: {
          eco_badge_level: badge.badgeLevel,
          eco_badge_title: badge.badgeTitle,
          eco_carbon_saved_kg: badge.carbonSavedKg,
          eco_orders_count: badge.ecoOrdersCount,
        },
      });
    } catch (e) {
      // 필드가 없을 수 있음 (마이그레이션 전) - 무시
    }

    res.success(badge, '친환경 뱃지 조회 완료');
  }),

  /**
   * 관리자용: 전체 매장 에코 뱃지 일괄 갱신
   */
  refreshAllEcoBadges: catchAsync(async (req, res) => {
    const stores = await prisma.stores.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    const results = [];
    for (const { id } of stores) {
      try {
        const service = new EcoBadgeService();
        const badge = await service.calculateEcoFootprint(id);
        await prisma.stores.update({
          where: { id },
          data: {
            eco_badge_level: badge.badgeLevel,
            eco_badge_title: badge.badgeTitle,
            eco_carbon_saved_kg: badge.carbonSavedKg,
            eco_orders_count: badge.ecoOrdersCount,
          },
        });
        results.push({ storeId: id, ...badge });
      } catch (e) {
        results.push({ storeId: id, error: e.message });
      }
    }

    res.success(results, '전체 매장 에코 뱃지 갱신 완료');
  }),
};

module.exports = ecoBadgeController;

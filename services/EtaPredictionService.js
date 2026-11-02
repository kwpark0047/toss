const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const OrderPaceSettings = require('../repositories/OrderPaceSettings');

const DEFAULT_COOKING_MINUTES = 10;
const MINUTES_PER_ORDER_AHEAD = 2;
const MINUTES_PER_EXTRA_UNIT = 1;
const MIN_ETA = 5;
const MAX_ETA = 90;

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

class EtaPredictionService {
  /**
   * 매장의 현재 조리 중인 주문 건수와 메뉴별 조리 시간(products.cooking_time)을 기반으로
   * 예상 소요 시간(분)을 계산한다.
   * - 주문 메뉴 중 가장 오래 걸리는 메뉴의 조리 시간을 기준으로 삼는다(동시 조리 가정)
   * - 앞선 주문 1건당 2분, 같은 주문의 추가 수량 1개당 1분, 바쁨 모드 추가 시간을 더한다
   */
  async calculateEta(storeId, items = []) {
    const numericStoreId = Number(storeId);
    try {
      const activeOrdersCount = await prisma.orders.count({
        where: {
          store_id: numericStoreId,
          status: { in: ['pending', 'confirmed', 'preparing'] },
        },
      });

      const lines = (Array.isArray(items) ? items : [])
        .map((item) => ({
          productId: toPositiveInt(item?.product_id),
          quantity: toPositiveInt(item?.quantity) || 1,
        }))
        .filter((line) => line.productId);

      let baseMinutes = DEFAULT_COOKING_MINUTES;
      if (lines.length > 0) {
        const products = await prisma.products.findMany({
          where: { store_id: numericStoreId, id: { in: [...new Set(lines.map((l) => l.productId))] } },
          select: { cooking_time: true },
        });
        const cookingTimes = products.map((p) => toPositiveInt(p.cooking_time)).filter(Boolean);
        if (cookingTimes.length > 0) baseMinutes = Math.max(...cookingTimes);
      }

      // 사장님 바쁨 모드의 추가 대기 시간
      const { extra_wait_minutes: extraWaitMinutes } =
        await OrderPaceSettings.findByStoreIdSafe(numericStoreId);

      const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
      const estimatedMinutes =
        baseMinutes +
        activeOrdersCount * MINUTES_PER_ORDER_AHEAD +
        Math.max(totalUnits - 1, 0) * MINUTES_PER_EXTRA_UNIT +
        extraWaitMinutes;

      const finalEta = Math.min(Math.max(Math.round(estimatedMinutes), MIN_ETA), MAX_ETA);
      logger.debug(
        { storeId: numericStoreId, activeOrdersCount, baseMinutes, finalEta },
        'Calculated smart ETA'
      );

      return {
        etaMinutes: finalEta,
        activeOrdersAhead: activeOrdersCount,
        message: `현재 주방 상황 기준 약 ${finalEta}분 소요 예상됩니다.`,
      };
    } catch (error) {
      logger.error({ error: error.message, storeId }, 'Failed to calculate smart ETA');
      return { etaMinutes: 15, activeOrdersAhead: 0, message: '약 15분 소요 예상됩니다.' };
    }
  }
}

module.exports = new EtaPredictionService();

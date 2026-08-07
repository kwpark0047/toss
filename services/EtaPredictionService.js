const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class EtaPredictionService {
  /**
   * 매장의 현재 조리 중인 주문 건수 및 메뉴별 평균 조리 시간을 기반으로 예상 소요 시간(ETA in minutes) 계산
   */
  async calculateEta(storeId, items = []) {
    try {
      const numericStoreId = Number(storeId);

      // 1. 현재 주방(KDS)에서 처리 대기 중이거나 조리 중인 주문 건수 조회
      const activeOrdersCount = await prisma.orders.count({
        where: {
          store_id: numericStoreId,
          status: { in: ['pending', 'confirmed', 'preparing'] },
        },
      });

      // 2. 기본 조리 시간 (기본 10분 + 주문당 2분 대기)
      let estimatedMinutes = 10 + activeOrdersCount * 2;

      // 3. 주문된 아이템들의 복잡도 가중치 반영
      if (items && items.length > 0) {
        // 복잡한 메뉴(예: 세트, 수제 등)가 포함된 경우 추가 시간 산정
        estimatedMinutes += items.reduce((acc, cur) => acc + (cur.quantity || 1) * 1.5, 0);
      }

      const finalEta = Math.min(Math.max(Math.round(estimatedMinutes), 5), 60); // 최소 5분, 최대 60분
      logger.debug(
        { storeId: numericStoreId, activeOrdersCount, finalEta },
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

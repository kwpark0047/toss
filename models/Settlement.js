const prisma = require('../config/prisma');

/**
 * [Settlement (정산) 모델 - Prisma 기반]
 * 매장별 매출 데이터를 기반으로 정산 금액을 계산하고 이력을 관리합니다.
 */
const Settlement = {
  /**
   * 1. 정산 데이터 생성 (Prisma 기반)
   */
  create: async (data) => {
    const { store_id, period_start, period_end } = data;
    const start = new Date(period_start);
    const end = new Date(period_end);
    end.setHours(23, 59, 59, 999);

    // 1-1. 장부(Ledger) 데이터 요약 조회 (Prisma aggregate)
    const summary = await prisma.ledger.aggregate({
      where: {
        store_id: parseInt(store_id),
        created_at: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        amount: true
      }
    });

    // 상세 분석 (Income vs Refund) - raw query나 여러번의 aggregate 대신 단순화된 로직 적용 가능
    // 여기서는 기존 로직의 의도(매출/환불 분리)를 Prisma 쿼리로 구현
    const stats = await prisma.ledger.groupBy({
      by: ['type'],
      where: {
        store_id: parseInt(store_id),
        created_at: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        amount: true
      }
    });

    let totalSales = 0;
    let totalRefunds = 0;

    stats.forEach(stat => {
      if (stat.type === 'INCOME') totalSales = stat._sum.amount || 0;
      if (stat.type === 'REFUND') totalRefunds = stat._sum.amount || 0;
    });

    const commission = Math.floor(totalSales * 0.03);
    const vat = Math.floor((totalSales - totalRefunds) * 0.1);
    const netAmount = totalSales - totalRefunds - commission - vat;

    const settlement = await prisma.settlements.create({
      data: {
        store_id: parseInt(store_id),
        period_start: start,
        period_end: end,
        total_sales: totalSales,
        total_refunds: totalRefunds,
        commission_amount: commission,
        vat_amount: vat,
        net_amount: netAmount,
        status: 'PENDING'
      }
    });

    return settlement;
  },

  /**
   * 2. 매장별 정산 내역 조회
   */
  findByStore: async (storeId) => {
    return await prisma.settlements.findMany({
      where: { store_id: parseInt(storeId) },
      orderBy: { period_end: 'desc' }
    });
  },

  /**
   * 3. 정산 상태 업데이트
   */
  updateStatus: async (id, status) => {
    const data = { status };
    if (status === 'COMPLETED' || status === 'PAID') {
      data.paid_at = new Date();
    }

    return await prisma.settlements.update({
      where: { id: parseInt(id) },
      data
    });
  }
};

module.exports = Settlement;

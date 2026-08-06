const prisma = require('../config/prisma');
const cron = require('node-cron');
const { apiLogger } = require('../utils/logger');

class PaymentReconciliationService {
  /**
   * 30분이 넘도록 PENDING 상태로 방치된 결제 및 주문 건 대사 검증 및 자동 보정
   */
  async reconcileStalePayments() {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      // pending 상태인 결제 내역 조회
      const stalePayments = await prisma.payments.findMany({
        where: {
          status: 'pending',
          created_at: { lt: thirtyMinutesAgo },
        },
        take: 50,
      });

      if (stalePayments.length === 0) return 0;

      let reconciledCount = 0;
      for (const payment of stalePayments) {
        // 결제 기한 만료로 실패 처리
        await prisma.$transaction(async (tx) => {
          await tx.payments.update({
            where: { id: payment.id },
            data: { status: 'CANCELED', updated_at: new Date() },
          });

          if (payment.order_id) {
            await tx.orders.updateMany({
              where: { id: payment.order_id, status: 'pending' },
              data: {
                status: 'cancelled',
                payment_status: 'failed',
                updated_at: new Date(),
              },
            });
          }
        });
        reconciledCount++;
      }

      apiLogger.info(
        { reconciledCount },
        'Payment reconciliation completed for stale transactions'
      );
      return reconciledCount;
    } catch (error) {
      apiLogger.error({ error: error.message }, 'Payment reconciliation failed');
      return 0;
    }
  }

  startScheduler() {
    // 매시간 정각에 결제 대사 실행
    cron.schedule(
      '0 * * * *',
      async () => {
        apiLogger.info('[결제대사] 정기 결제 대사 배치 작업 시작');
        await this.reconcileStalePayments();
      },
      { timezone: 'Asia/Seoul' }
    );
    apiLogger.info('[결제대사] 스케줄러 등록 완료 (매시간 정각)');
  }
}

module.exports = new PaymentReconciliationService();

const prisma = require('../config/prisma');

/**
 * [LedgerService]
 * 매출/환불 장부 기록을 처리합니다.
 * 모든 DB 접근은 Prisma Client를 통해 직접 수행합니다.
 */
class LedgerService {
  /**
   * 매출(수익) 장부를 기록합니다.
   * @param {object} params
   * @param {number} params.storeId
   * @param {number} params.orderId
   * @param {number} params.paymentId
   * @param {number} params.amount
   * @param {string} params.method
   * @param {string} params.description
   * @param {import('@prisma/client').PrismaTransactionClient} [tx] - 트랜잭션 클라이언트
   * @returns {Promise<object>}
   */
  async recordIncome({ storeId, orderId, paymentId, amount, method, description }, tx) {
    const db = tx || prisma;
    return db.ledger.create({
      data: {
        store_id: storeId,
        order_id: orderId,
        payment_id: paymentId,
        type: 'INCOME',
        category: 'SALE',
        amount,
        method,
        description
      }
    });
  }

  /**
   * 환불 장부를 기록합니다.
   * @param {object} params
   * @param {number} params.storeId
   * @param {number} params.orderId
   * @param {number} params.paymentId
   * @param {number} params.amount
   * @param {string} params.method
   * @param {string} params.description
   * @param {import('@prisma/client').PrismaTransactionClient} [tx] - 트랜잭션 클라이언트
   * @returns {Promise<object>}
   */
  async recordRefund({ storeId, orderId, paymentId, amount, method, description }, tx) {
    const db = tx || prisma;
    return db.ledger.create({
      data: {
        store_id: storeId,
        order_id: orderId,
        payment_id: paymentId,
        type: 'REFUND',
        category: 'CANCEL',
        amount,
        method,
        description
      }
    });
  }
}

module.exports = new LedgerService();

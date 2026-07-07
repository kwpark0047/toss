const prisma = require('../config/prisma');

/**
 * [PointService]
 * 포인트 계산, 사용자 관리, 적립/사용/취소 트랜잭션을 처리합니다.
 * 모든 DB 접근은 Prisma Client를 통해 직접 수행합니다.
 */
class PointService {
  /**
   * 적립 가능한 포인트를 계산합니다.
   * @param {number} amount - 결제 금액
   * @param {number|string} storeId - 매장 ID
   * @param {{ phone?: string, toss_user_key?: string }} identifier - 고객 식별자
   * @returns {Promise<number>} 적립 포인트
   */
  async calculateEarnPoints(amount, storeId, identifier) {
    const settings = await prisma.store_point_settings.findUnique({
      where: { store_id: parseInt(storeId) }
    });
    if (!settings || !settings.is_enabled) return 0;
    if (amount < settings.min_earn_amount) return 0;

    let earnRate = settings.earn_rate;

    if (identifier) {
      const { phone, toss_user_key } = identifier;
      const where = { store_id: parseInt(storeId) };
      if (phone) where.customer_phone = phone;
      else if (toss_user_key) where.toss_user_key = toss_user_key;

      if (Object.keys(where).length > 1) {
        const customer = await prisma.store_customers.findFirst({ where });
        if (customer && customer.tier !== 'GENERAL') {
          const tiers = await prisma.store_tier_settings.findMany({
            where: { store_id: parseInt(storeId) }
          });
          const currentTier = tiers.find(t => t.tier_name === customer.tier);
          if (currentTier) {
            earnRate = currentTier.earn_rate;
          }
        }
      }
    }

    return Math.floor(amount * (earnRate / 100));
  }

  /**
   * 포인트 사용자를 조회하거나 생성합니다.
   * @param {{ toss_user_key?: string, phone?: string, user_id?: number }} identifier
   * @param {import('@prisma/client').PrismaTransactionClient} [tx] - 트랜잭션 클라이언트
   * @returns {Promise<{ id: number, total_points: number, lifetime_earned: number, lifetime_used: number }>}
   */
  async findOrCreateUser(identifier, tx) {
    const { toss_user_key, phone, user_id } = identifier;
    const where = {};
    if (toss_user_key) where.toss_user_key = toss_user_key;
    else if (phone) where.phone = phone;
    else if (user_id) where.user_id = user_id;

    const db = tx || prisma;
    let user = await db.user_points.findFirst({ where });
    if (!user) {
      user = await db.user_points.create({
        data: {
          user_id: user_id || null,
          toss_user_key: toss_user_key || null,
          phone: phone || null,
          total_points: 0
        }
      });
    }
    return user;
  }

  /**
   * 결제에 대해 포인트를 적립합니다 (트랜잭션 내에서 사용).
   * @param {number} storeId
   * @param {number} orderId
   * @param {number} paymentId
   * @param {string} orderNumber
   * @param {string} phone - 고객 전화번호
   * @param {number} earnAmount - 적립할 포인트
   * @param {import('@prisma/client').PrismaTransactionClient} tx
   * @returns {Promise<object|null>} 적립 트랜잭션 레코드
   */
  async earn(orderId, paymentId, storeId, orderNumber, phone, earnAmount, tx) {
    if (earnAmount <= 0 || !phone) return null;

    // phone은 unique 키가 아니므로 upsert 불가 → findFirst + update/create
    // (user_points.phone은 스키마상 @@index만 존재. 나머지 메서드도 동일 패턴 사용)
    let userPoint = await tx.user_points.findFirst({ where: { phone } });
    if (userPoint) {
      userPoint = await tx.user_points.update({
        where: { id: userPoint.id },
        data: {
          total_points: { increment: earnAmount },
          lifetime_earned: { increment: earnAmount }
        }
      });
    } else {
      userPoint = await tx.user_points.create({
        data: {
          phone,
          total_points: earnAmount,
          lifetime_earned: earnAmount
        }
      });
    }

    return tx.point_transactions.create({
      data: {
        user_point_id: userPoint.id,
        store_id: storeId,
        order_id: orderId,
        payment_id: paymentId,
        type: 'earn',
        amount: earnAmount,
        balance_after: userPoint.total_points + earnAmount,
        description: `주문(#${orderNumber}) 적립`,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
  }

  /**
   * 포인트를 사용합니다 (트랜잭션 내에서 사용).
   * @param {number} orderId
   * @param {number} paymentId
   * @param {number} storeId
   * @param {string} orderNumber
   * @param {{ phone?: string, toss_user_key?: string }} identifier
   * @param {number} pointAmount - 사용할 포인트
   * @param {import('@prisma/client').PrismaTransactionClient} tx
   * @returns {Promise<object>} 사용 트랜잭션 레코드
   */
  async use(orderId, paymentId, storeId, orderNumber, identifier, pointAmount, tx) {
    const user = await this.findOrCreateUser(identifier, tx);
    if (!user || user.total_points < pointAmount) {
      throw new Error('포인트가 부족합니다');
    }

    const newBalance = user.total_points - pointAmount;
    await tx.user_points.update({
      where: { id: user.id },
      data: {
        total_points: newBalance,
        lifetime_used: { increment: pointAmount },
        updated_at: new Date()
      }
    });

    return tx.point_transactions.create({
      data: {
        user_point_id: user.id,
        store_id: storeId,
        order_id: orderId,
        payment_id: paymentId,
        type: 'use',
        amount: -pointAmount,
        balance_after: newBalance,
        description: `주문(#${orderNumber}) 포인트 사용`
      }
    });
  }

  /**
   * 결제 취소 시 포인트를 회수/복구합니다 (트랜잭션 내에서 사용).
   * @param {number} paymentId
   * @param {import('@prisma/client').PrismaTransactionClient} tx
   */
  async revertOnCancel(paymentId, tx) {
    const pointTxs = await tx.point_transactions.findMany({
      where: { payment_id: paymentId }
    });

    for (const pt of pointTxs) {
      if (pt.type === 'earn') {
        const user = await tx.user_points.findFirst({
          where: { id: pt.user_point_id }
        });
        if (user) {
          const newBalance = Math.max(0, user.total_points - pt.amount);
          await tx.user_points.update({
            where: { id: user.id },
            data: { total_points: newBalance, lifetime_earned: { decrement: pt.amount }, updated_at: new Date() }
          });
          await tx.point_transactions.create({
            data: {
              user_point_id: user.id,
              store_id: pt.store_id,
              order_id: pt.order_id,
              payment_id: pt.payment_id,
              type: 'cancel_earn',
              amount: -pt.amount,
              balance_after: newBalance,
              description: `결제 취소 포인트 회수`
            }
          });
        }
      } else if (pt.type === 'use') {
        const usedAmount = Math.abs(pt.amount);
        const user = await tx.user_points.findFirst({
          where: { id: pt.user_point_id }
        });
        if (user) {
          const newBalance = user.total_points + usedAmount;
          await tx.user_points.update({
            where: { id: user.id },
            data: { total_points: newBalance, lifetime_used: { decrement: usedAmount }, updated_at: new Date() }
          });
          await tx.point_transactions.create({
            data: {
              user_point_id: user.id,
              store_id: pt.store_id,
              order_id: pt.order_id,
              payment_id: pt.payment_id,
              type: 'cancel_use',
              amount: usedAmount,
              balance_after: newBalance,
              description: `결제 취소 포인트 복구`
            }
          });
        }
      }
    }
  }
}

module.exports = new PointService();

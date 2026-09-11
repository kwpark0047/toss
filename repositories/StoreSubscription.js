const prisma = require('../config/prisma');

/**
 * StoreSubscription (매장 구독) 리포지토리
 * store_subscriptions 테이블 전용 — Toss 구독/결제 상태 동기화
 */
class StoreSubscriptionRepository {
  /**
   * 매장 ID로 구독 조회 (store_id는 unique)
   */
  async findByStoreId(storeId) {
    return await prisma.store_subscriptions.findUnique({
      where: { store_id: storeId },
    });
  }

  /**
   * Toss subscriptionId로 역매핑 (웹훅에서 store_id 발견용)
   */
  async findBySubscriptionId(subscriptionId) {
    return await prisma.store_subscriptions.findUnique({
      where: { subscription_id: subscriptionId },
    });
  }

  /**
   * 매장별 구독 upsert (store_id 기준 — 이미 존재하면 데이터 덮어쓰기)
   */
  async upsertByStore(storeId, data) {
    return await prisma.store_subscriptions.upsert({
      where: { store_id: storeId },
      create: {
        store_id: storeId,
        ...data,
      },
      update: {
        ...data,
        updated_at: new Date(),
      },
    });
  }
}

module.exports = new StoreSubscriptionRepository();

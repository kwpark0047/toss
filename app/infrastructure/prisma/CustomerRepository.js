const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CustomerRepository {
  async findById(storeId, customerId) {
    return prisma.store_customers.findFirst({
      where: { id: parseInt(customerId), store_id: parseInt(storeId) },
    });
  }

  async findByPhone(storeId, phone) {
    return prisma.store_customers.findFirst({
      where: { store_id: storeId, customer_phone: phone },
    });
  }

  async upsert(data) {
    return prisma.store_customers.upsert({
      where: {
        uk_store_customer: { store_id: data.store_id, customer_phone: data.customer_phone },
      },
      create: data,
      update: {
        visit_count: { increment: 1 },
        total_spent: { increment: data.total_spent },
        tier: data.tier,
        last_visit_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async checkDuplicateEarn(orderId) {
    return prisma.point_transactions.findFirst({
      where: { order_id: orderId, type: 'earn' },
    });
  }

  async findWelcomeCoupon(storeId) {
    return prisma.coupons.findFirst({
      where: { store_id: storeId, is_active: 1, name: { contains: '웰컴' } },
    });
  }

  async findCouponById(storeId, couponId) {
    return prisma.coupons.findFirst({
      where: { id: couponId, store_id: storeId, is_active: 1 },
    });
  }

  async checkDuplicateCoupon(customerPhone, couponId) {
    return prisma.user_coupons.findFirst({
      where: { customer_phone: customerPhone, coupon_id: couponId, status: 'UNUSED' },
    });
  }

  async issueCoupon(customerPhone, couponId, expiresAt) {
    return prisma.user_coupons.create({
      data: { customer_phone: customerPhone, coupon_id: couponId, status: 'UNUSED', expires_at: expiresAt },
    });
  }

  async getStats(storeId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [all, newThisMonth, tierCounts, churned, tiers] = await Promise.all([
      prisma.store_customers.aggregate({
        where: { store_id: storeId },
        _count: { id: true },
        _avg: { visit_count: true, total_spent: true },
      }),
      prisma.store_customers.count({ where: { store_id: storeId, created_at: { gte: startOfMonth } } }),
      prisma.store_customers.groupBy({ by: ['tier'], where: { store_id: storeId }, _count: { id: true } }),
      prisma.store_customers.count({ where: { store_id: storeId, last_visit_at: { lt: thirtyDaysAgo } } }),
      prisma.store_tier_settings.findMany({ where: { store_id: storeId }, orderBy: { min_spent: 'asc' } }),
    ]);

    const tierMap = {};
    tierCounts.forEach((t) => { tierMap[t.tier] = t._count.id; });

    return {
      total_customers: all._count.id || 0,
      new_this_month: newThisMonth,
      avg_visit_count: Math.round((all._avg.visit_count || 0) * 10) / 10,
      avg_spent: Math.round(all._avg.total_spent || 0),
      tier_distribution: tierMap,
      churned_30d: churned,
      tiers,
    };
  }

  async getHistory(storeId, customerId) {
    const customer = await prisma.store_customers.findFirst({
      where: { id: customerId, store_id: storeId },
    });
    if (!customer) return null;

    const [pointInfo, recentOrders, pointHistory, activeCoupons, tiers] = await Promise.all([
      prisma.user_points.findFirst({
        where: { phone: customer.customer_phone },
        select: { total_points: true, lifetime_earned: true, lifetime_used: true },
      }),
      prisma.orders.findMany({
        where: { store_id: customer.store_id, customer_phone: customer.customer_phone },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { id: true, total_amount: true, status: true, created_at: true, order_type: true },
      }),
      prisma.point_transactions.findMany({
        where: { store_id: customer.store_id, user_points: { phone: customer.customer_phone } },
        orderBy: { created_at: 'desc' },
        take: 15,
        select: { id: true, type: true, amount: true, balance_after: true, description: true, created_at: true },
      }),
      prisma.user_coupons.findMany({
        where: {
          customer_phone: customer.customer_phone,
          status: 'UNUSED',
          OR: [{ expires_at: null }, { expires_at: { gte: new Date() } }],
        },
        include: { coupons: { select: { name: true, amount: true, type: true, store_id: true } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      prisma.store_tier_settings.findMany({ where: { store_id: customer.store_id }, orderBy: { min_spent: 'asc' } }),
    ]);

    const nextTier = tiers
      .filter((t) => t.min_spent > customer.total_spent)
      .sort((a, b) => a.min_spent - b.min_spent)[0] || null;

    return {
      customer,
      point_balance: pointInfo?.total_points || 0,
      lifetime_earned: pointInfo?.lifetime_earned || 0,
      lifetime_used: pointInfo?.lifetime_used || 0,
      recent_orders: recentOrders,
      point_history: pointHistory,
      active_coupons: activeCoupons,
      tiers,
      next_tier: nextTier,
    };
  }

  async findByStoreId(storeId, options = {}) {
    const { sortBy = 'last_visit_at', order = 'desc', limit = 50, search = '' } = options;
    const where = { store_id: parseInt(storeId) };

    if (search) {
      where.OR = [
        { customer_phone: { contains: search } },
        { customer_name: { contains: search } },
      ];
    }

    return prisma.store_customers.findMany({
      where,
      orderBy: { [sortBy]: order },
      take: limit,
    });
  }

  async getNearbyStores(lat, lng) {
    const { haversineKm } = require('../../utils/geo');
    const NEARBY_DISTANCE_KM = 0.5;

    const activeStores = await prisma.stores.findMany({
      where: { is_active: true, latitude: { not: null }, longitude: { not: null } },
      include: { coupons: { where: { is_active: 1 }, take: 1 } },
    });

    return activeStores.find((store) => {
      const distance = haversineKm(lat, lng, store.latitude, store.longitude);
      return distance <= NEARBY_DISTANCE_KM;
    }) || null;
  }

  async getCoupons(storeId) {
    return prisma.coupons.findMany({
      where: { store_id: storeId, is_active: 1 },
      orderBy: { created_at: 'desc' },
    });
  }

  async registerFcmToken(storeId, phone, fcmToken) {
    return prisma.store_customers.upsert({
      where: { uk_store_customer: { store_id: storeId, customer_phone: phone } },
      update: { fcm_token: fcmToken, updated_at: new Date() },
      create: { store_id: storeId, customer_phone: phone, fcm_token: fcmToken },
    });
  }

  async findByPhoneGlobal(phone) {
    return prisma.user_points.findFirst({
      where: { phone },
      select: { user_id: true, phone: true },
    });
  }
}

module.exports = new CustomerRepository();

import prisma from '../config/prisma';
import Point from '../repositories/Point';
import StoreTier from '../repositories/StoreTier';
import StoreCustomer from '../repositories/StoreCustomer';
import { normalizePhone } from '../utils/phoneEncryption';
import { haversineKm } from '../utils/geo';
import logger from '../utils/logger';

interface PhoneJoinData {
  phone: string;
  store_id: string | number;
  order_id?: string | number;
  total_amount?: string | number;
}

interface LocationData {
  phone: string;
  latitude: number;
  longitude: number;
}

interface FcmTokenData {
  phone: string;
  store_id: string | number;
  fcm_token: string;
}

class CustomerService {
  async phoneJoin({ phone, store_id, order_id, total_amount }: PhoneJoinData) {
    const normalizedPhone = normalizePhone(phone);
    const storeId = parseInt(String(store_id));
    const amount = parseInt(String(total_amount)) || 0;
    const orderId = order_id ? parseInt(String(order_id)) : null;

    if (orderId) {
      const alreadyEarned = await prisma.point_transactions.findFirst({
        where: { order_id: orderId, type: 'earn' }
      });
      if (alreadyEarned) {
        return { duplicate: true, message: '이미 포인트가 적립된 주문입니다.' };
      }
    }

    const existingCustomer = await prisma.store_customers.findFirst({
      where: { store_id: storeId, customer_phone: normalizedPhone }
    });
    const isNewCustomer = !existingCustomer;

    const newTotalSpent = (existingCustomer?.total_spent || 0) + amount;
    const newTier = await StoreTier.calculateTier(storeId, newTotalSpent);

    const customer = await prisma.store_customers.upsert({
      where: { uk_store_customer: { store_id: storeId, customer_phone: normalizedPhone } },
      create: {
        store_id: storeId, customer_phone: normalizedPhone,
        visit_count: 1, total_spent: amount, tier: newTier.tier_name, last_visit_at: new Date()
      },
      update: {
        visit_count: { increment: 1 }, total_spent: { increment: amount },
        tier: newTier.tier_name, last_visit_at: new Date(), updated_at: new Date()
      }
    });

    const earnPoints = amount > 0
      ? await Point.calculateEarnPoints(amount, storeId, { phone: normalizedPhone })
      : 0;

    let pointResult: any = null;
    let totalPoints = 0;
    if (earnPoints > 0) {
      pointResult = await Point.earn({
        identifier: { phone: normalizedPhone }, store_id: storeId, order_id: orderId,
        amount: earnPoints, description: `주문 적립 (${amount.toLocaleString()}원)`
      });
      totalPoints = pointResult.balance;
    } else {
      const balance = await Point.getBalance({ phone: normalizedPhone });
      totalPoints = balance.total_points;
    }

    let welcomeCoupon: any = null;
    if (isNewCustomer) {
      const coupon = await prisma.coupons.findFirst({
        where: { store_id: storeId, is_active: 1, name: { contains: '웰컴' } }
      });
      if (coupon) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + coupon.valid_days);
        await prisma.user_coupons.create({
          data: { customer_phone: normalizedPhone, coupon_id: coupon.id, status: 'UNUSED', expires_at: expiresAt }
        });
        welcomeCoupon = { name: coupon.name, amount: coupon.amount, type: coupon.type };
      }
    }

    if (orderId) {
      await prisma.notifications.create({
        data: { store_id: storeId, type: 'NEW_ORDER', title: '주문 알림 등록',
          message: `${normalizedPhone} 고객님의 알림이 등록되었습니다.`, priority: 'low' }
      }).catch((err: Error) => logger.warn(`[알림 실패] 고객 알림 등록 (store ${storeId}): ${err.message}`));
    }

    const allTiers = await StoreTier.getTiers(storeId);
    const nextTier = allTiers
      .filter((t: any) => t.min_spent > newTotalSpent)
      .sort((a: any, b: any) => a.min_spent - b.min_spent)[0] || null;

    return {
      is_new_customer: isNewCustomer, points_earned: earnPoints, total_points: totalPoints,
      customer_tier: newTier.tier_name, earn_rate: newTier.earn_rate,
      visit_count: customer.visit_count, total_spent: customer.total_spent,
      welcome_coupon: welcomeCoupon,
      next_tier: nextTier ? { name: nextTier.tier_name, remaining: nextTier.min_spent - newTotalSpent } : null,
      socket_channel: `customer-orders-${normalizedPhone}`
    };
  }

  async getStats(storeId: string | number) {
    const sid = parseInt(String(storeId));
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [all, newThisMonth, tierCounts, churned, tiers] = await Promise.all([
      prisma.store_customers.aggregate({
        where: { store_id: sid }, _count: { id: true }, _avg: { visit_count: true, total_spent: true },
      }),
      prisma.store_customers.count({ where: { store_id: sid, created_at: { gte: startOfMonth } } }),
      prisma.store_customers.groupBy({ by: ['tier'], where: { store_id: sid }, _count: { id: true } }),
      prisma.store_customers.count({ where: { store_id: sid, last_visit_at: { lt: thirtyDaysAgo } } }),
      prisma.store_tier_settings.findMany({ where: { store_id: sid }, orderBy: { min_spent: 'asc' } }),
    ]);

    const tierMap: Record<string, number> = {};
    tierCounts.forEach(t => { tierMap[t.tier] = t._count.id; });

    return {
      total_customers: all._count.id || 0, new_this_month: newThisMonth,
      avg_visit_count: Math.round((all._avg.visit_count || 0) * 10) / 10,
      avg_spent: Math.round(all._avg.total_spent || 0),
      tier_distribution: tierMap, churned_30d: churned, tiers,
    };
  }

  async getHistory(storeId: string | number, customerId: string | number) {
    const customer = await prisma.store_customers.findFirst({
      where: { id: parseInt(String(customerId)), store_id: parseInt(String(storeId)) },
    });
    if (!customer) return null;

    const [pointInfo, recentOrders, pointHistory, activeCoupons, tiers] = await Promise.all([
      prisma.user_points.findFirst({
        where: { phone: customer.customer_phone },
        select: { total_points: true, lifetime_earned: true, lifetime_used: true },
      }),
      prisma.orders.findMany({
        where: { store_id: customer.store_id, customer_phone: customer.customer_phone },
        orderBy: { created_at: 'desc' }, take: 10,
        select: { id: true, total_amount: true, status: true, created_at: true, order_type: true },
      }),
      prisma.point_transactions.findMany({
        where: { store_id: customer.store_id, user_points: { phone: customer.customer_phone } },
        orderBy: { created_at: 'desc' }, take: 15,
        select: { id: true, type: true, amount: true, balance_after: true, description: true, created_at: true },
      }),
      prisma.user_coupons.findMany({
        where: { customer_phone: customer.customer_phone, status: 'UNUSED', OR: [{ expires_at: null }, { expires_at: { gte: new Date() } }] },
        include: { coupons: { select: { name: true, amount: true, type: true, store_id: true } } },
        orderBy: { created_at: 'desc' }, take: 10,
      }),
      prisma.store_tier_settings.findMany({ where: { store_id: customer.store_id }, orderBy: { min_spent: 'asc' } }),
    ]);

    const nextTier = tiers.filter(t => t.min_spent > customer.total_spent)
      .sort((a, b) => a.min_spent - b.min_spent)[0] || null;

    return { customer, point_balance: pointInfo?.total_points || 0,
      lifetime_earned: pointInfo?.lifetime_earned || 0, lifetime_used: pointInfo?.lifetime_used || 0,
      recent_orders: recentOrders, point_history: pointHistory, active_coupons: activeCoupons,
      tiers, next_tier: nextTier };
  }

  async issueCoupon(storeId: string | number, customerId: string | number, couponId: string | number) {
    const customer = await prisma.store_customers.findFirst({
      where: { id: parseInt(String(customerId)), store_id: parseInt(String(storeId)) },
    });
    if (!customer) return { error: '고객 정보 없음', status: 404 };

    const coupon = await prisma.coupons.findFirst({
      where: { id: parseInt(String(couponId)), store_id: parseInt(String(storeId)), is_active: 1 },
    });
    if (!coupon) return { error: '쿠폰 정보 없음', status: 404 };

    const alreadyHas = await prisma.user_coupons.findFirst({
      where: { customer_phone: customer.customer_phone, coupon_id: coupon.id, status: 'UNUSED' },
    });
    if (alreadyHas) return { error: '이미 보유 중인 쿠폰입니다.', status: 409 };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (coupon.valid_days || 30));

    const issued = await prisma.user_coupons.create({
      data: { customer_phone: customer.customer_phone, coupon_id: coupon.id, status: 'UNUSED', expires_at: expiresAt },
    });
    return { issued, couponName: coupon.name };
  }

  async updateLocation({ phone, latitude, longitude }: LocationData) {
    const activeStores = await prisma.stores.findMany({
      where: { is_active: true, latitude: { not: null }, longitude: { not: null } },
      include: { coupons: { where: { is_active: 1 }, take: 1 } }
    });

    const NEARBY_DISTANCE_KM = 0.5;
    const nearbyStore = activeStores.find(store => {
      const distance = haversineKm(latitude, longitude, store.latitude, store.longitude);
      return distance <= NEARBY_DISTANCE_KM;
    });

    if (nearbyStore && nearbyStore.coupons.length > 0) {
      const user = await prisma.users.findFirst({
        where: { user_points: { some: { phone: phone } } },
        select: { fcm_token: true }
      });
      if (user && user.fcm_token) {
        return { fcm_token: user.fcm_token, store: nearbyStore, coupon: nearbyStore.coupons[0] };
      }
    }
    return null;
  }

  async registerFcmToken({ phone, store_id, fcm_token }: FcmTokenData) {
    const storeId = parseInt(String(store_id));
    await prisma.store_customers.upsert({
      where: { uk_store_customer: { store_id: storeId, customer_phone: phone } },
      update: { fcm_token, updated_at: new Date() },
      create: { store_id: storeId, customer_phone: phone, fcm_token }
    });
  }

  async getCustomerDetail(customerId: number, userId: number, userRole: string) {
    const customer = await StoreCustomer.findById(customerId);
    if (!customer) return { error: '고객 정보를 찾을 수 없습니다.', status: 404 };

    if (userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, customer.store_id);
      if (!role) return { error: '해당 매장의 고객 정보에 접근할 권한이 없습니다.', status: 403 };
    }

    return { customer };
  }
}

export default CustomerService;

import prisma from '../config/prisma';
import Point from '../repositories/Point';
import StoreTier from '../repositories/StoreTier';

interface Identifier {
  user_id?: number;
  phone?: string;
  toss_user_key?: string;
}

interface HistoryOptions {
  store_id?: number;
  limit?: number;
  offset?: number;
  type?: string;
}

interface Balance {
  id: number;
  user_id?: number;
  phone?: string;
  toss_user_key?: string;
  total_points: number;
}

interface WalletLookupResult {
  balance: Balance;
  history: any[];
  store_settings: any;
  tier_info: {
    current: any;
    next: any;
    total_spent: number;
    remaining_for_next: number;
  } | null;
}

interface UsablePointsResult {
  total_points: number;
  usable_points: number;
  max_discount: number;
}

class PointsService {
  async getBalance(identifier: Identifier): Promise<Balance> {
    return await Point.getBalance(identifier);
  }

  async getHistory(identifier: Identifier, options: HistoryOptions) {
    const history = await Point.getHistory(identifier, options);
    return {
      transactions: history,
      pagination: {
        limit: options.limit || 20,
        offset: options.offset || 0
      }
    };
  }

  async walletLookup(identifier: Identifier, storeId?: number): Promise<WalletLookupResult> {
    const balance = await Point.getBalance(identifier);
    const history = await Point.getHistory(identifier, {
      store_id: storeId || undefined,
      limit: 5
    });

    let storeSettings: any = null;
    let tierInfo: any = null;

    if (storeId) {
      storeSettings = await Point.getStoreSettings(storeId);

      if (balance.user_id || balance.phone || balance.toss_user_key) {
        const userPoint = await (prisma as any).user_points.findFirst({
          where: {
            OR: [
              { id: balance.id },
              { phone: identifier.phone || undefined },
              { toss_user_key: identifier.toss_user_key || undefined }
            ]
          }
        });

        if (userPoint) {
          const customer = await (prisma as any).store_customers.findFirst({
            where: {
              store_id: storeId,
              OR: [
                { customer_phone: userPoint.phone || undefined },
                { toss_user_key: userPoint.toss_user_key || undefined }
              ]
            }
          });

          if (customer) {
            const tiers = await StoreTier.getTiers(storeId);
            const currentTier = tiers.find((t: any) => t.tier_name === customer.tier) || {
              tier_name: 'GENERAL',
              earn_rate: 1.0,
              min_spent: 0
            };
            const nextTier = tiers.find((t: any) => t.min_spent > customer.total_spent);
            tierInfo = {
              current: currentTier,
              next: nextTier || null,
              total_spent: customer.total_spent,
              remaining_for_next: nextTier ? nextTier.min_spent - customer.total_spent : 0
            };
          }
        }
      }
    }

    return {
      balance,
      history: history || [],
      store_settings: storeSettings,
      tier_info: tierInfo
    };
  }

  async calculateUsablePoints(amount: number, storeId: number, userId: number): Promise<UsablePointsResult> {
    const identifier = { user_id: userId };
    const balance = await Point.getBalance(identifier);
    const usablePoints = await Point.calculateUsablePoints(amount, balance.total_points, storeId);
    return {
      total_points: balance.total_points,
      usable_points: usablePoints,
      max_discount: usablePoints
    };
  }

  async getStoreSettings(storeId: number) {
    return await Point.getStoreSettings(storeId);
  }

  async updateStoreSettings(storeId: number, data: any) {
    return await Point.updateStoreSettings(storeId, data);
  }

  async adminEarn(identifier: Identifier, storeId: number, amount: number, description?: string) {
    return await Point.earn({
      identifier,
      store_id: storeId,
      amount,
      description: description || '관리자 수동 적립'
    });
  }

  async adminDeduct(identifier: Identifier, storeId: number, amount: number, description?: string) {
    return await Point.use({
      identifier,
      store_id: storeId,
      amount,
      description: description || '관리자 수동 차감'
    });
  }

  async calculateEarnPoints(amount: number, storeId: number | string, identifier?: Identifier): Promise<number> {
    if (identifier) {
      const settings = await (prisma as any).store_point_settings.findUnique({
        where: { store_id: parseInt(String(storeId)) }
      });
      if (!settings || !settings.is_enabled) return 0;
      if (amount < settings.min_earn_amount) return 0;

      let earnRate = settings.earn_rate;
      const { phone, toss_user_key } = identifier;
      const where: any = { store_id: parseInt(String(storeId)) };
      if (phone) where.customer_phone = phone;
      else if (toss_user_key) where.toss_user_key = toss_user_key;

      if (Object.keys(where).length > 1) {
        const customer = await (prisma as any).store_customers.findFirst({ where });
        if (customer && customer.tier !== 'GENERAL') {
          const tiers = await (prisma as any).store_tier_settings.findMany({
            where: { store_id: parseInt(String(storeId)) }
          });
          const currentTier = tiers.find((t: any) => t.tier_name === customer.tier);
          if (currentTier) {
            earnRate = currentTier.earn_rate;
          }
        }
      }

      return Math.floor(amount * (earnRate / 100));
    }

    return await Point.calculateEarnPoints(amount, storeId);
  }

  async earn(orderId: number, paymentId: number, storeId: number, orderNumber: string, phone: string, amount: number, tx?: any) {
    return await Point.earn({
      order_id: orderId,
      payment_id: paymentId,
      store_id: storeId,
      order_number: orderNumber,
      phone,
      amount,
      tx
    });
  }

  async use(orderId: number, paymentId: number, storeId: number, orderNumber: string, identifier: Identifier, amount: number, tx?: any) {
    return await Point.use({
      order_id: orderId,
      payment_id: paymentId,
      store_id: storeId,
      order_number: orderNumber,
      identifier,
      amount,
      tx
    });
  }

  async revertOnCancel(orderId: number, storeId: number, tx?: any) {
    return await Point.revertOnCancel(orderId, storeId, tx);
  }
}

export default new PointsService();

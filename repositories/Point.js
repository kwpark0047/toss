const prisma = require('../config/prisma');

/**
 * 포인트 모델 (Prisma 기반)
 * 사용자 포인트 관리 및 거래 내역을 담당합니다.
 */
const Point = {
  // 사용자 포인트 조회 또는 생성
  findOrCreateUser: async (identifier) => {
    const { toss_user_key, phone, user_id } = identifier;

    // 조건 설정
    const where = {};
    if (toss_user_key) where.toss_user_key = toss_user_key;
    else if (phone) where.phone = phone;
    else if (user_id) where.user_id = user_id;

    if (Object.keys(where).length === 0) return null;

    // 기존 사용자 조회 (unique 제약 조건이 없는 필드로도 조회 가능하도록 findFirst 사용)
    let user = await prisma.user_points.findFirst({ where });

    if (!user) {
      // 신규 사용자 생성
      user = await prisma.user_points.create({
        data: {
          user_id: user_id || null,
          toss_user_key: toss_user_key || null,
          phone: phone || null,
          total_points: 0
        }
      });
    }
    return user;
  },

  // 사용자 포인트 잔액 조회
  getBalance: async (identifier) => {
    const user = await Point.findOrCreateUser(identifier);
    if (!user) return { total_points: 0, available_points: 0, lifetime_earned: 0, lifetime_used: 0 };

    return {
      total_points: user.total_points,
      available_points: user.total_points,
      lifetime_earned: user.lifetime_earned,
      lifetime_used: user.lifetime_used
    };
  },

  // 포인트 적립 (트랜잭션 적용)
  earn: async (data) => {
    const { identifier, store_id, order_id, payment_id, amount, description } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 사용자 조회/생성 (트랜잭션 내에서 수행)
      const { toss_user_key, phone, user_id } = identifier;
      const where = {};
      if (toss_user_key) where.toss_user_key = toss_user_key;
      else if (phone) where.phone = phone;
      else if (user_id) where.user_id = user_id;

      let user = await tx.user_points.findFirst({ where });
      if (!user) {
        user = await tx.user_points.create({
          data: {
            user_id: user_id || null,
            toss_user_key: toss_user_key || null,
            phone: phone || null,
            total_points: 0
          }
        });
      }

      const newBalance = user.total_points + amount;
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // 2. 사용자 잔액 및 누적 적립액 업데이트
      await tx.user_points.update({
        where: { id: user.id },
        data: {
          total_points: newBalance,
          lifetime_earned: { increment: amount },
          updated_at: new Date()
        }
      });

      // 3. 거래 내역 생성
      const transaction = await tx.point_transactions.create({
        data: {
          user_point_id: user.id,
          store_id,
          order_id: order_id || null,
          payment_id: payment_id || null,
          type: 'earn',
          amount,
          balance_after: newBalance,
          description: description || '주문 적립',
          expires_at: expiresAt
        }
      });

      return { transaction_id: transaction.id, amount, balance: newBalance };
    });
  },

  // 포인트 사용 (트랜잭션 적용)
  use: async (data) => {
    const { identifier, store_id, order_id, payment_id, amount, description } = data;

    return await prisma.$transaction(async (tx) => {
      const user = await Point.findOrCreateUser(identifier); // 여기선 findUnique를 직접 써도 됨
      if (!user || user.total_points < amount) throw new Error('포인트가 부족합니다');

      const newBalance = user.total_points - amount;

      // 1. 사용자 잔액 및 누적 사용액 업데이트
      await tx.user_points.update({
        where: { id: user.id },
        data: {
          total_points: newBalance,
          lifetime_used: { increment: amount },
          updated_at: new Date()
        }
      });

      // 2. 거래 내역 생성
      const transaction = await tx.point_transactions.create({
        data: {
          user_point_id: user.id,
          store_id,
          order_id,
          payment_id: payment_id || null,
          type: 'use',
          amount: -amount,
          balance_after: newBalance,
          description: description || '주문 사용'
        }
      });

      return { transaction_id: transaction.id, amount, balance: newBalance };
    });
  },

  // 포인트 취소 (환불 - 트랜잭션 적용)
  cancel: async (data) => {
    const { identifier, store_id, order_id, payment_id, original_type, amount, description } = data;

    return await prisma.$transaction(async (tx) => {
      const user = await Point.findOrCreateUser(identifier);
      if (!user) throw new Error('사용자를 찾을 수 없습니다');

      let newBalance;
      const updateData = { updated_at: new Date() };

      if (original_type === 'earn') {
        newBalance = Math.max(0, user.total_points - amount);
        updateData.total_points = newBalance;
        updateData.lifetime_earned = { decrement: amount };
      } else {
        newBalance = user.total_points + amount;
        updateData.total_points = newBalance;
        updateData.lifetime_used = { decrement: amount };
      }

      // 1. 사용자 정보 업데이트
      await tx.user_points.update({
        where: { id: user.id },
        data: updateData
      });

      const cancelType = original_type === 'earn' ? 'cancel_earn' : 'cancel_use';

      // 2. 거래 내역 생성
      const transaction = await tx.point_transactions.create({
        data: {
          user_point_id: user.id,
          store_id,
          order_id,
          payment_id: payment_id || null,
          type: cancelType,
          amount: original_type === 'earn' ? -amount : amount,
          balance_after: newBalance,
          description: description || '취소'
        }
      });

      return { transaction_id: transaction.id, amount, balance: newBalance };
    });
  },

  // 포인트 거래 내역 조회
  getHistory: async (identifier, options = {}) => {
    const user = await Point.findOrCreateUser(identifier);
    if (!user) return [];

    const where = { user_point_id: user.id };
    if (options.store_id) where.store_id = options.store_id;
    if (options.type) where.type = options.type;

    const transactions = await prisma.point_transactions.findMany({
      where,
      select: {
        id: true,
        amount: true,
        type: true,
        balance_after: true,
        description: true,
        created_at: true,
        stores: {
          select: { name: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: options.limit || undefined,
      skip: options.offset || undefined
    });

    return transactions.map(pt => ({
      ...pt,
      store_name: pt.stores?.name
    }));
  },

  // 매장 포인트 설정 조회
  getStoreSettings: async (storeId) => {
    let settings = await prisma.store_point_settings.findUnique({
      where: { store_id: storeId }
    });

    if (!settings) {
      settings = await prisma.store_point_settings.create({
        data: { store_id: storeId }
      });
    }
    return settings;
  },

  // 매장 포인트 설정 업데이트
  updateStoreSettings: async (storeId, data) => {
    await prisma.store_point_settings.update({
      where: { store_id: storeId },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
    return Point.getStoreSettings(storeId);
  },

  // 포인트 적립 계산 (등급별 가변 적립률 적용)
  calculateEarnPoints: async (amount, storeId, identifier = null) => {
    const settings = await Point.getStoreSettings(storeId);
    if (!settings.is_enabled || amount < settings.min_earn_amount) return 0;

    let earnRate = settings.earn_rate;

    // 고객 등급 정보가 있는 경우 등급별 적립률 우선 적용
    if (identifier) {
      const { phone, toss_user_key } = identifier;
      const where = { store_id: parseInt(storeId) };
      if (phone) where.customer_phone = phone;
      else if (toss_user_key) where.toss_user_key = toss_user_key;

      if (Object.keys(where).length > 1) {
        const customer = await prisma.store_customers.findFirst({ where });
        if (customer && customer.tier !== 'GENERAL') {
          const StoreTier = require('./StoreTier');
          const tiers = await StoreTier.getTiers(storeId);
          const currentTier = tiers.find(t => t.tier_name === customer.tier);
          if (currentTier) {
            earnRate = currentTier.earn_rate;
            const logger = require('../utils/logger');
            logger.debug(`[Point] 등급(${customer.tier}) 적립률 적용: ${earnRate}%`);
          }
        }
      }
    }

    return Math.floor(amount * (earnRate / 100));
  },

  // 사용 가능 포인트 계산
  calculateUsablePoints: async (totalAmount, userPoints, storeId) => {
    const settings = await Point.getStoreSettings(storeId);
    if (!settings.is_enabled || userPoints < settings.min_use_points) return 0;
    const maxUsable = Math.floor(totalAmount * (settings.max_use_rate / 100));
    return Math.min(userPoints, maxUsable);
  },

  // 결제 ID로 트랜잭션 조회
  findByPaymentId: async (paymentId) => {
    return await prisma.point_transactions.findMany({
      where: { payment_id: paymentId }
    });
  }
};

module.exports = Point;

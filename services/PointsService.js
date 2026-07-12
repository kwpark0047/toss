const prisma = require('../config/prisma');
const Point = require('../repositories/Point');
const StoreTier = require('../repositories/StoreTier');
const { AppError } = require('../utils/errorHandler');

class PointsService {
    /**
     * 포인트 잔액 조회
     */
    async getBalance(identifier) {
        return await Point.getBalance(identifier);
    }

    /**
     * 포인트 내역 조회
     */
    async getHistory(identifier, options) {
        const history = await Point.getHistory(identifier, options);
        return {
            transactions: history,
            pagination: {
                limit: options.limit || 20,
                offset: options.offset || 0
            }
        };
    }

    /**
     * 월렛 조회 (포인트 잔액 + 내역 + 매장 설정 + 등급 정보)
     */
    async walletLookup(identifier, storeId) {
        const balance = await Point.getBalance(identifier);
        const history = await Point.getHistory(identifier, {
            store_id: storeId || undefined,
            limit: 5
        });

        let storeSettings = null;
        let tierInfo = null;

        if (storeId) {
            storeSettings = await Point.getStoreSettings(storeId);

            if (balance.user_id || balance.phone || balance.toss_user_key) {
                const userPoint = await prisma.user_points.findFirst({
                    where: {
                        OR: [
                            { id: balance.id },
                            { phone: identifier.phone || undefined },
                            { toss_user_key: identifier.toss_user_key || undefined }
                        ]
                    }
                });

                if (userPoint) {
                    const customer = await prisma.store_customers.findFirst({
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
                        const currentTier = tiers.find(t => t.tier_name === customer.tier) || {
                            tier_name: 'GENERAL',
                            earn_rate: 1.0,
                            min_spent: 0
                        };
                        const nextTier = tiers.find(t => t.min_spent > customer.total_spent);
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

    /**
     * 예상 적립 포인트 계산
     */
    async calculateEarnPoints(amount, storeId) {
        return await Point.calculateEarnPoints(amount, storeId);
    }

    /**
     * 사용 가능 포인트 계산
     */
    async calculateUsablePoints(amount, storeId, userId) {
        const identifier = { user_id: userId };
        const balance = await Point.getBalance(identifier);
        const usablePoints = await Point.calculateUsablePoints(amount, balance.total_points, storeId);
        return {
            total_points: balance.total_points,
            usable_points: usablePoints,
            max_discount: usablePoints
        };
    }

    /**
     * 매장 포인트 설정 조회
     */
    async getStoreSettings(storeId) {
        return await Point.getStoreSettings(storeId);
    }

    /**
     * 매장 포인트 설정 업데이트
     */
    async updateStoreSettings(storeId, data) {
        return await Point.updateStoreSettings(storeId, data);
    }

    /**
     * 수동 포인트 적립 (관리자용)
     */
    async adminEarn(identifier, storeId, amount, description) {
        return await Point.earn({
            identifier,
            store_id: storeId,
            amount,
            description: description || '관리자 수동 적립'
        });
    }

    /**
     * 수동 포인트 차감 (super_admin 전용)
     */
    async adminDeduct(identifier, storeId, amount, description) {
        return await Point.use({
            identifier,
            store_id: storeId,
            amount,
            description: description || '관리자 수동 차감'
        });
    }
}

module.exports = PointsService;

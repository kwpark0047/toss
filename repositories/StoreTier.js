const prisma = require('../config/prisma');

/**
 * [매장 등급 설정 모델]
 * 매장별 등급 조건(누적 금액)과 혜택(적립률)을 관리합니다.
 */
const StoreTier = {
    /**
     * [매장별 모든 등급 설정 조회]
     */
    getTiers: async (storeId) => {
        return await prisma.store_tier_settings.findMany({
            where: { store_id: parseInt(storeId) },
            orderBy: { min_spent: 'asc' }
        });
    },

    /**
     * [특정 등급 설정 업데이트/생성]
     */
    upsertTier: async (storeId, data) => {
        const { tier_name, min_spent, earn_rate } = data;
        return await prisma.store_tier_settings.upsert({
            where: {
                uk_store_tier: {
                    store_id: parseInt(storeId),
                    tier_name
                }
            },
            update: {
                min_spent: parseInt(min_spent),
                earn_rate: parseFloat(earn_rate),
                updated_at: new Date()
            },
            create: {
                store_id: parseInt(storeId),
                tier_name,
                min_spent: parseInt(min_spent),
                earn_rate: parseFloat(earn_rate)
            }
        });
    },

    /**
     * [매장 등급 설정 삭제]
     */
    deleteTier: async (storeId, tier_name) => {
        return await prisma.store_tier_settings.delete({
            where: {
                uk_store_tier: {
                    store_id: parseInt(storeId),
                    tier_name
                }
            }
        });
    },

    /**
     * [누적 금액에 맞는 등급 결정]
     */
    calculateTier: async (storeId, totalSpent) => {
        const tiers = await StoreTier.getTiers(storeId);

        // 누적 금액이 높은 순으로 확인하여 조건에 맞는 가장 높은 등급 반환
        const sortedTiers = [...tiers].sort((a, b) => b.min_spent - a.min_spent);

        for (const tier of sortedTiers) {
            if (totalSpent >= tier.min_spent) {
                return tier;
            }
        }

        return { tier_name: 'GENERAL', earn_rate: 1.0 }; // 기본 등급
    }
};

module.exports = StoreTier;

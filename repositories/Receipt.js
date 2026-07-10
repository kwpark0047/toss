const prisma = require('../config/prisma');

/**
 * 영수증 설정 모델 (Prisma 기반)
 */
const Receipt = {
    // 매장 영수증 설정 조회
    findByStoreId: async (storeId) => {
        return await prisma.store_receipt_settings.findUnique({
            where: { store_id: parseInt(storeId) }
        });
    },

    // 매장 영수증 설정 업데이트
    update: async (storeId, data) => {
        return await prisma.store_receipt_settings.upsert({
            where: { store_id: parseInt(storeId) },
            update: {
                ...data,
                updated_at: new Date()
            },
            create: {
                store_id: parseInt(storeId),
                ...data,
                updated_at: new Date()
            }
        });
    }
};

module.exports = Receipt;

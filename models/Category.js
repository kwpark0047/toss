const prisma = require('../config/prisma');

/**
 * 카테고리 모델 (Prisma 기반)
 * 매장별 상품 카테고리 관리 및 정렬을 담당합니다.
 */
const Category = {
    // [카테고리 생성]
    create: async (data) => {
        const { store_id, name, sort_order = 0 } = data;
        return await prisma.categories.create({
            data: {
                store_id: parseInt(store_id),
                name,
                sort_order: parseInt(sort_order)
            }
        });
    },

    // [카테고리 상세 조회]
    findById: async (id) => {
        try {
            return await prisma.categories.findUnique({
                where: { id: parseInt(id) }
            });
        } catch (error) {
            console.error(`[Prisma Error] Category.findById failed for ID: ${id}`, error);
            return null;
        }
    },

    // [매장별 카테고리 목록 조회]
    findByStoreId: async (storeId) => {
        try {
            return await prisma.categories.findMany({
                where: { store_id: parseInt(storeId) },
                orderBy: { sort_order: 'asc' }
            });
        } catch (error) {
            console.error(`[Prisma Error] Category.findByStoreId failed for Store: ${storeId}`, error);
            return [];
        }
    },

    // [카테고리 정보 업데이트]
    update: async (id, data) => {
        const { name, sort_order } = data;
        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order);

        if (Object.keys(updateData).length === 0) return await Category.findById(id);

        return await prisma.categories.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    },

    // [카테고리 삭제]
    delete: async (id) => {
        await prisma.categories.delete({
            where: { id: parseInt(id) }
        });
        return true;
    }
};

module.exports = Category;

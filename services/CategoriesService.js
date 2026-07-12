const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class CategoriesService {
    /**
     * 매장별 카테고리 조회
     */
    async getStoreCategories(storeId) {
        if (isNaN(storeId)) {
            throw new AppError('유효하지 않은 매장 ID입니다.', 400);
        }
        return await prisma.categories.findMany({
            where: { store_id: storeId },
            orderBy: { sort_order: 'asc' }
        });
    }

    /**
     * 카테고리 일괄 정렬 순서 업데이트
     */
    async updateSortOrders(orders) {
        if (!Array.isArray(orders)) {
            throw new AppError('orders 배열이 필요합니다.', 400);
        }
        await Promise.all(
            orders.map(({ id, sort_order }) =>
                prisma.categories.update({
                    where: { id: parseInt(id) },
                    data: { sort_order: parseInt(sort_order) }
                })
            )
        );
        logger.info(`카테고리 정렬 업데이트: ${orders.length}개`);
    }

    /**
     * 카테고리 생성
     */
    async createCategory(data) {
        const { store_id, name, sort_order } = data;
        if (!store_id || !name?.trim()) {
            throw new AppError('매장 ID와 카테고리 이름이 필요합니다.', 400);
        }

        const maxOrder = await prisma.categories.aggregate({
            where: { store_id: parseInt(store_id) },
            _max: { sort_order: true }
        });

        const category = await prisma.categories.create({
            data: {
                store_id: parseInt(store_id),
                name: name.trim(),
                sort_order: sort_order !== undefined ? parseInt(sort_order) : (maxOrder._max.sort_order ?? 0) + 1
            }
        });

        logger.info(`카테고리 생성: store=${store_id}, name=${name}`);
        return category;
    }

    /**
     * 카테고리 수정
     */
    async updateCategory(id, data) {
        if (isNaN(id)) {
            throw new AppError('유효하지 않은 ID입니다.', 400);
        }

        const { name, sort_order } = data;
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order);

        const category = await prisma.categories.update({
            where: { id },
            data: updateData
        });

        logger.info(`카테고리 수정: id=${id}`);
        return category;
    }

    /**
     * 카테고리 삭제
     */
    async deleteCategory(id) {
        if (isNaN(id)) {
            throw new AppError('유효하지 않은 ID입니다.', 400);
        }
        await prisma.categories.delete({ where: { id } });
        logger.info(`카테고리 삭제: id=${id}`);
    }

    /**
     * 전체 카테고리 목록 조회
     */
    async getAllCategories() {
        return await prisma.categories.findMany({
            orderBy: { sort_order: 'asc' }
        });
    }

    /**
     * 카테고리 단일 조회
     */
    async getCategoryById(id) {
        if (isNaN(id)) {
            throw new AppError('유효하지 않은 ID입니다.', 400);
        }
        const category = await prisma.categories.findUnique({ where: { id } });
        if (!category) {
            throw new AppError('카테고리를 찾을 수 없습니다.', 404);
        }
        return category;
    }
}

module.exports = CategoriesService;

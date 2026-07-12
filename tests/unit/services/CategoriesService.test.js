jest.mock('../../../config/prisma', () => ({
    categories: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
    },
}));
jest.mock('../../../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const CategoriesService = require('../../../services/CategoriesService');
const prisma = require('../../../config/prisma');

describe('CategoriesService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new CategoriesService();
    });

    describe('getStoreCategories', () => {
        test('매장별 카테고리를 정렬 순으로 조회한다', async () => {
            prisma.categories.findMany.mockResolvedValue([
                { id: 1, name: '메인', sort_order: 1 },
                { id: 2, name: '추가', sort_order: 2 }
            ]);
            const result = await svc.getStoreCategories(1);
            expect(result).toHaveLength(2);
            expect(prisma.categories.findMany).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: { sort_order: 'asc' }
            }));
        });

        test('유효하지 않은 매장 ID면 400 에러', async () => {
            await expect(svc.getStoreCategories('abc')).rejects.toThrow('유효하지 않은 매장 ID입니다.');
        });
    });

    describe('updateSortOrders', () => {
        test('카테고리 정렬 순서를 일괄 업데이트한다', async () => {
            prisma.categories.update.mockResolvedValue({});
            await svc.updateSortOrders([{ id: 1, sort_order: 1 }, { id: 2, sort_order: 0 }]);
            expect(prisma.categories.update).toHaveBeenCalledTimes(2);
        });

        test('orders가 배열이 아니면 400 에러', async () => {
            await expect(svc.updateSortOrders('not_array')).rejects.toThrow('orders 배열이 필요합니다.');
        });
    });

    describe('createCategory', () => {
        test('카테고리를 생성한다', async () => {
            prisma.categories.aggregate.mockResolvedValue({ _max: { sort_order: 3 } });
            prisma.categories.create.mockResolvedValue({ id: 10, name: '신규', sort_order: 4 });
            const result = await svc.createCategory({ store_id: '1', name: '신규' });
            expect(result.sort_order).toBe(4);
        });

        test('sort_order을 명시하면 해당 값을 사용한다', async () => {
            prisma.categories.create.mockResolvedValue({ id: 10, name: '신규', sort_order: 100 });
            const result = await svc.createCategory({ store_id: '1', name: '신규', sort_order: '100' });
            expect(result.sort_order).toBe(100);
        });

        test('store_id나 name 없으면 400 에러', async () => {
            await expect(svc.createCategory({ store_id: '1', name: '' })).rejects.toThrow('매장 ID와 카테고리 이름이 필요합니다.');
        });
    });

    describe('updateCategory', () => {
        test('카테고리를 수정한다', async () => {
            prisma.categories.update.mockResolvedValue({ id: 1, name: '수정됨' });
            const result = await svc.updateCategory(1, { name: '수정됨' });
            expect(result.name).toBe('수정됨');
        });

        test('유효하지 않은 ID면 400 에러', async () => {
            await expect(svc.updateCategory('abc', {})).rejects.toThrow('유효하지 않은 ID입니다.');
        });
    });

    describe('deleteCategory', () => {
        test('카테고리를 삭제한다', async () => {
            prisma.categories.delete.mockResolvedValue({});
            await svc.deleteCategory(1);
            expect(prisma.categories.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        test('유효하지 않은 ID면 400 에러', async () => {
            await expect(svc.deleteCategory('abc')).rejects.toThrow('유효하지 않은 ID입니다.');
        });
    });

    describe('getAllCategories', () => {
        test('전체 카테고리를 조회한다', async () => {
            prisma.categories.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const result = await svc.getAllCategories();
            expect(result).toHaveLength(2);
        });
    });

    describe('getCategoryById', () => {
        test('카테고리를 단일 조회한다', async () => {
            prisma.categories.findUnique.mockResolvedValue({ id: 1, name: '메인' });
            const result = await svc.getCategoryById(1);
            expect(result.id).toBe(1);
        });

        test('카테고리가 없으면 404 에러', async () => {
            prisma.categories.findUnique.mockResolvedValue(null);
            await expect(svc.getCategoryById(999)).rejects.toThrow('카테고리를 찾을 수 없습니다.');
        });
    });
});

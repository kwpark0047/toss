// categoriesController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    getStoreCategories: jest.fn(),
    updateSortOrders: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getAllCategories: jest.fn(),
    getCategoryById: jest.fn(),
};
jest.mock('../../../services/CategoriesService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const categoriesController = require('../../../controllers/categoriesController');

describe('categoriesController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {} };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn(), created: jest.fn() };
        next = jest.fn();
    });

    describe('getStoreCategories', () => {
        test('매장별 카테고리를 조회한다', async () => {
            req.params.storeId = '1';
            mockService.getStoreCategories.mockResolvedValue([
                { id: 1, name: '메인' },
                { id: 2, name: '추가' }
            ]);
            await categoriesController.getStoreCategories(req, res);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, name: '메인' }, { id: 2, name: '추가' }]);
        });
    });

    describe('updateSortOrders', () => {
        test('카테고리 정렬 순서를 업데이트한다', async () => {
            req.body = { orders: [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }] };
            mockService.updateSortOrders.mockResolvedValue();
            await categoriesController.updateSortOrders(req, res);
            expect(res.json).toHaveBeenCalledWith({ message: '정렬 순서가 업데이트되었습니다.' });
        });
    });

    describe('createCategory', () => {
        test('카테고리를 생성한다', async () => {
            req.body = { name: '신규 카테고리', store_id: 1 };
            mockService.createCategory.mockResolvedValue({ id: 3, name: '신규 카테고리' });
            await categoriesController.createCategory(req, res);
            expect(res.created).toHaveBeenCalledWith({ id: 3, name: '신규 카테고리' });
        });
    });

    describe('updateCategory', () => {
        test('카테고리를 수정한다', async () => {
            req.params.id = '1';
            req.body = { name: '수정된 카테고리' };
            mockService.updateCategory.mockResolvedValue({ id: 1, name: '수정된 카테고리' });
            await categoriesController.updateCategory(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('deleteCategory', () => {
        test('카테고리를 삭제한다', async () => {
            req.params.id = '1';
            mockService.deleteCategory.mockResolvedValue();
            await categoriesController.deleteCategory(req, res);
            expect(res.json).toHaveBeenCalledWith({ message: '카테고리가 삭제되었습니다.' });
        });
    });

    describe('getAllCategories', () => {
        test('전체 카테고리 목록을 조회한다', async () => {
            mockService.getAllCategories.mockResolvedValue([{ id: 1 }]);
            await categoriesController.getAllCategories(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('getCategoryById', () => {
        test('카테고리를 단일 조회한다', async () => {
            req.params.id = '1';
            mockService.getCategoryById.mockResolvedValue({ id: 1, name: '메인' });
            await categoriesController.getCategoryById(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });
});

// productsController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    getStoreProducts: jest.fn(),
    getProductById: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    bulkCreate: jest.fn(),
    importFromStore: jest.fn(),
};
jest.mock('../../../services/ProductsService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const productsController = require('../../../controllers/productsController');

describe('productsController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, app: { get: jest.fn() } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn() };
        next = jest.fn();
        req.app.get.mockReturnValue(null);
    });

    describe('getStoreProducts', () => {
        test('매장별 상품 목록을 조회한다', async () => {
            req.params.storeId = '1';
            req.query = { category_id: '2' };
            mockService.getStoreProducts.mockResolvedValue({
                data: [{ id: 1, name: '아메리카노' }],
                fromCache: false
            });
            await productsController.getStoreProducts(req, res);
            expect(res.success).toHaveBeenCalledWith([{ id: 1, name: '아메리카노' }]);
        });
    });

    describe('getProductById', () => {
        test('상품 상세를 조회한다', async () => {
            req.params.id = '1';
            mockService.getProductById.mockResolvedValue({ id: 1, name: '라떼' });
            await productsController.getProductById(req, res);
            expect(res.success).toHaveBeenCalledWith({ id: 1, name: '라떼' });
        });
    });

    describe('createProduct', () => {
        test('상품을 생성한다', async () => {
            req.body = { store_id: 1, name: '카푸치노', price: 5500 };
            mockService.createProduct.mockResolvedValue({ id: 1 });
            await productsController.createProduct(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('updateProduct', () => {
        test('상품을 수정한다', async () => {
            req.params.id = '1';
            req.body = { name: '라떼 업데이트' };
            mockService.updateProduct.mockResolvedValue({ id: 1, store_id: 1 });
            await productsController.updateProduct(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('deleteProduct', () => {
        test('상품을 삭제한다', async () => {
            req.params.id = '1';
            mockService.deleteProduct.mockResolvedValue();
            await productsController.deleteProduct(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('bulkCreate', () => {
        test('상품을 일괄 등록한다', async () => {
            req.body = { store_id: 1, products: [{ name: 'A' }, { name: 'B' }] };
            mockService.bulkCreate.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            await productsController.bulkCreate(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('importFromStore', () => {
        test('다른 매장에서 메뉴를 가져온다', async () => {
            req.body = { target_store_id: 1, source_store_id: 2 };
            mockService.importFromStore.mockResolvedValue([{ id: 1 }]);
            await productsController.importFromStore(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });
});

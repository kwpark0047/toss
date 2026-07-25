// ProductsService 단위 테스트
jest.mock('../../../repositories/Product', () => ({
    findByStoreId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
}));
jest.mock('../../../utils/cache', () => ({
    get: jest.fn(),
    set: jest.fn(),
    flushByStore: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../../services/aiService');

const ProductsService = require('../../../services/ProductsService');
const Product = require('../../../repositories/Product');
const cache = require('../../../utils/cache');

describe('ProductsService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new ProductsService();
    });

    describe('getStoreProducts', () => {
        test('캐시 히트 시 캐시된 데이터를 반환한다', async () => {
            const cachedProducts = [{ id: 1, name: '아메리카노' }];
            cache.get.mockReturnValue(cachedProducts);

            const result = await svc.getStoreProducts(1);

            expect(result.data).toEqual(cachedProducts);
            expect(result.fromCache).toBe(true);
            expect(Product.findByStoreId).not.toHaveBeenCalled();
        });

        test('캐시 미스 시 DB에서 조회하고 캐시에 저장한다', async () => {
            cache.get.mockReturnValue(null);
            const dbProducts = [{ id: 1, name: '라떼' }, { id: 2, name: '카푸치노' }];
            Product.findByStoreId.mockResolvedValue(dbProducts);

            const result = await svc.getStoreProducts(1);

            expect(result.data).toEqual(dbProducts);
            expect(result.fromCache).toBe(false);
            expect(cache.set).toHaveBeenCalledWith('store:1:products:all', dbProducts, 60);
        });

        test('category_id가 있으면 해당 카테고리 상품만 조회한다', async () => {
            cache.get.mockReturnValue(null);
            Product.findByStoreId.mockResolvedValue([{ id: 1 }]);

            await svc.getStoreProducts(1, { category_id: 5 });

            expect(Product.findByStoreId).toHaveBeenCalledWith(1, 5);
            expect(cache.set).toHaveBeenCalledWith('store:1:products:5', expect.any(Array), 60);
        });

        test('유효한 lang이 있으면 AI 번역을 적용한다', async () => {
            cache.get.mockReturnValue(null);
            const products = [{ id: 1, name: '아메리카노', description: '맛있는 커피' }];
            Product.findByStoreId.mockResolvedValue(products);

            const aiService = require('../../../services/aiService');
            aiService.batchTranslateMenus.mockResolvedValue([
                { id: 1, translated_name: 'Americano', translated_description: 'Delicious coffee' }
            ]);

            const result = await svc.getStoreProducts(1, { lang: 'en' });

            expect(result.fromCache).toBe(false);
            expect(result.data[0].name).toBe('Americano');
            expect(result.data[0].description).toBe('Delicious coffee');
        });

        test('잘못된 lang이 있으면 번역 없이 조회한다', async () => {
            cache.get.mockReturnValue(null);
            const products = [{ id: 1, name: '아메리카노' }];
            Product.findByStoreId.mockResolvedValue(products);

            const result = await svc.getStoreProducts(1, { lang: 'invalid' });

            expect(result.data).toEqual(products);
            expect(cache.set).toHaveBeenCalledWith('store:1:products:all', products, 60);
        });
    });

    describe('getProductById', () => {
        test('상품이 존재하면 해당 상품을 반환한다', async () => {
            const product = { id: 1, name: '아메리카노', price: 4500 };
            Product.findById.mockResolvedValue(product);

            const result = await svc.getProductById(1);

            expect(result).toEqual(product);
        });

        test('상품이 없으면 404 에러를 던진다', async () => {
            Product.findById.mockResolvedValue(null);

            await expect(svc.getProductById(999)).rejects.toThrow('상품을 찾을 수 없습니다.');
        });
    });

    describe('createProduct', () => {
        test('상품을 생성하고 캐시를 무효화한다', async () => {
            const data = { store_id: 1, name: '라떼', price: 5000 };
            const created = { id: 1, ...data };
            Product.create.mockResolvedValue(created);

            const result = await svc.createProduct(data);

            expect(result).toEqual(created);
            expect(Product.create).toHaveBeenCalledWith(data);
            expect(cache.flushByStore).toHaveBeenCalledWith(1);
        });
    });

    describe('updateProduct', () => {
        test('상품을 수정하고 캐시를 무효화한다', async () => {
            const updated = { id: 1, store_id: 1, name: '라떼 업데이트', price: 5500 };
            Product.update.mockResolvedValue(updated);

            const result = await svc.updateProduct(1, { name: '라떼 업데이트', price: 5500 });

            expect(result).toEqual(updated);
            expect(cache.flushByStore).toHaveBeenCalledWith(1);
        });

        test('WebSocket io가 있으면 소켓으로 업데이트를 전파한다', async () => {
            const io = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
            const updated = { id: 1, store_id: 1, name: '라떼', price: 5000, is_sold_out: false, cooking_time: 5 };
            Product.update.mockResolvedValue(updated);

            await svc.updateProduct(1, { name: '라떼' }, io);

            expect(io.to).toHaveBeenCalledWith('store - 1');
        });
    });

    describe('deleteProduct', () => {
        test('상품을 삭제하고 캐시를 무효화한다', async () => {
            Product.findById.mockResolvedValue({ id: 1, store_id: 1 });
            Product.delete.mockResolvedValue(true);

            await svc.deleteProduct(1);

            expect(Product.delete).toHaveBeenCalledWith(1);
            expect(cache.flushByStore).toHaveBeenCalledWith(1);
        });
    });

    describe('bulkCreate', () => {
        test('상품 배열을 일괄 등록한다', async () => {
            const products = [
                { store_id: 1, name: '아메리카노', price: 4500 },
                { store_id: 1, name: '라떼', price: 5000 },
            ];
            Product.create.mockResolvedValue({ id: 1 });

            const result = await svc.bulkCreate(1, products);

            expect(Product.create).toHaveBeenCalledTimes(2);
            expect(cache.flushByStore).toHaveBeenCalledWith(1);
        });

        test('products 배열이 없으면 400 에러를 던진다', async () => {
            await expect(svc.bulkCreate(1, null)).rejects.toThrow('products 배열이 필요합니다.');
        });

        test('products가 배열이 아니면 400 에러를 던진다', async () => {
            await expect(svc.bulkCreate(1, 'invalid')).rejects.toThrow('products 배열이 필요합니다.');
        });
    });

    describe('importFromStore', () => {
        test('다른 매장에서 메뉴를 가져온다', async () => {
            const sourceProducts = [
                { id: 1, store_id: 2, name: '에스프레소', price: 3500, created_at: new Date(), updated_at: new Date() },
            ];
            Product.findByStoreId.mockResolvedValue(sourceProducts);
            Product.create.mockResolvedValue({ id: 10, store_id: 5 });

            const result = await svc.importFromStore(5, 2);

            expect(result).toHaveLength(1);
            expect(cache.flushByStore).toHaveBeenCalledWith(5);
        });
    });
});

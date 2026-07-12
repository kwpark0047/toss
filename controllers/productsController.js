const catchAsync = require('../utils/catchAsync');
const ProductsService = require('../services/ProductsService');

const productsService = new ProductsService();

const productsController = {
    // [GET] 매장별 상품 목록 조회 (캐시 적용)
    getStoreProducts: catchAsync(async (req, res) => {
        const { category_id, lang } = req.query;
        const result = await productsService.getStoreProducts(req.params.storeId, { category_id, lang });
        res.success(result.data);
    }),

    // [GET] 상품 상세 조회
    getProductById: catchAsync(async (req, res) => {
        const product = await productsService.getProductById(req.params.id);
        res.success(product);
    }),

    // [POST] 상품 생성
    createProduct: catchAsync(async (req, res) => {
        const product = await productsService.createProduct(req.body);
        res.success(product, '상품이 생성되었습니다.', 201);
    }),

    // [PUT] 상품 정보 수정
    updateProduct: catchAsync(async (req, res) => {
        const io = req.app.get('io');
        const product = await productsService.updateProduct(req.params.id, req.body, io);
        res.success(product, '상품 정보가 수정되었습니다.');
    }),

    // [DELETE] 상품 삭제
    deleteProduct: catchAsync(async (req, res) => {
        await productsService.deleteProduct(req.params.id);
        res.success(null, '상품이 삭제되었습니다.');
    }),

    // [POST] 상품 일괄 등록
    bulkCreate: catchAsync(async (req, res) => {
        const { store_id, products } = req.body;
        const createdProducts = await productsService.bulkCreate(store_id, products);
        res.success(createdProducts, `${createdProducts.length}개의 상품이 등록되었습니다.`, 201);
    }),

    // [POST] 다른 매장에서 메뉴 가져오기
    importFromStore: catchAsync(async (req, res) => {
        const { target_store_id, source_store_id } = req.body;
        const imported = await productsService.importFromStore(target_store_id, source_store_id);
        res.success(imported, `${imported.length}개의 메뉴를 성공적으로 가져왔습니다.`);
    })
};

module.exports = productsController;

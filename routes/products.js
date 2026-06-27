const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { product: schema } = require('../utils/validationSchemas');
const catchAsync = require('../utils/catchAsync');

// 매장별 상품 목록 조회
router.get('/store/:storeId', catchAsync(async (req, res) => {
    const { category_id } = req.query;
    const products = await Product.findByStoreId(req.params.storeId, category_id);
    res.success(products);
}));

// 상품 상세 조회
router.get('/:id', catchAsync(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
    res.success(product);
}));

// 상품 생성
router.post('/', authMiddleware, validate(schema.create), catchAsync(async (req, res) => {
    const logger = require('../utils/logger');
    logger.info(`상품 생성: store=${req.body.store_id}, name=${req.body.name}, price=${req.body.price}`);
    const product = await Product.create(req.body);
    res.success(product, '상품이 생성되었습니다', 201);
}));

// 상품 정보 수정
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const product = await Product.update(req.params.id, req.body);

    const io = req.app.get('io');
    if (io && product.store_id) {
        io.to(`store-${product.store_id}`).emit('product-updated', {
            productId: product.id,
            is_sold_out: product.is_sold_out,
            cooking_time: product.cooking_time,
            name: product.name,
            price: product.price
        });
        const logger = require('../utils/logger');
        logger.info(`소켓 상품 업데이트 전파: store=${product.store_id}, productId=${product.id}`);
    }
    res.success(product, '상품 정보가 수정되었습니다');
}));

// 상품 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    await Product.delete(req.params.id);
    res.success(null, '상품이 삭제되었습니다');
}));

// 상품 일괄 등록
router.post('/bulk', authMiddleware, catchAsync(async (req, res) => {
    const { store_id, products } = req.body;
    if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'products 배열이 필요합니다.' });
    }
    const createdProducts = await Promise.all(
        products.map(p => Product.create({ ...p, store_id: parseInt(store_id) }))
    );
    res.success(createdProducts, `${createdProducts.length}개의 상품이 등록되었습니다.`, 201);
}));

// 다른 매장에서 메뉴 가져오기
router.post('/import', authMiddleware, catchAsync(async (req, res) => {
    const { target_store_id, source_store_id } = req.body;
    const sourceProducts = await Product.findByStoreId(source_store_id);

    const imported = await Promise.all(
        sourceProducts.map(p => {
            const { id: _id, store_id: _sid, created_at: _ca, updated_at: _ua, ...rest } = p;
            return Product.create({ ...rest, store_id: parseInt(target_store_id) });
        })
    );

    res.success(imported, `${imported.length}개의 메뉴를 성공적으로 가져왔습니다.`);
}));

module.exports = router;

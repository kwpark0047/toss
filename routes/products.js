const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { product: schema } = require('../utils/validationSchemas');
const productsController = require('../controllers/productsController');

// 매장별 상품 목록 조회 - 고객 메뉴판의 최다 노출 경로로 60초 캐시 적용
router.get('/store/:storeId', productsController.getStoreProducts);

// 상품 상세 조회
router.get('/:id', productsController.getProductById);

// 상품 생성
router.post('/', authMiddleware, validate(schema.create), productsController.createProduct);

// 상품 정보 수정
router.put('/:id', authMiddleware, productsController.updateProduct);

// 상품 삭제
router.delete('/:id', authMiddleware, productsController.deleteProduct);

// 상품 일괄 등록
router.post('/bulk', authMiddleware, productsController.bulkCreate);

// 다른 매장에서 메뉴 가져오기
router.post('/import', authMiddleware, productsController.importFromStore);

module.exports = router;

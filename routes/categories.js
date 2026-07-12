const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const categoriesController = require('../controllers/categoriesController');

// 1. 매장별 카테고리 조회 (상세 경로 우선)
router.get('/store/:storeId', categoriesController.getStoreCategories);

// 2. 카테고리 일괄 정렬 순서 업데이트 (/:id 보다 먼저 위치)
router.put('/sort', authMiddleware, categoriesController.updateSortOrders);

// 3. 카테고리 생성
router.post('/', authMiddleware, categoriesController.createCategory);

// 4. 카테고리 수정
router.put('/:id', authMiddleware, categoriesController.updateCategory);

// 5. 카테고리 삭제
router.delete('/:id', authMiddleware, categoriesController.deleteCategory);

// 6. 전체 카테고리 목록 조회
router.get('/', categoriesController.getAllCategories);

// 7. 카테고리 단일 조회
router.get('/:id', categoriesController.getCategoryById);

module.exports = router;

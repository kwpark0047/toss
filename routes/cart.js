const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const catchAsync = require('../utils/catchAsync');

// [GET] 특정 테이블의 공유 장바구니 조회
router.get('/:tableId', catchAsync(cartController.getCart));

// [POST] 장바구니 아이템 추가/수정
router.post('/:tableId', catchAsync(cartController.updateCart));

// [DELETE] 특정 테이블의 장바구니 전체 초기화
router.delete('/:tableId', catchAsync(cartController.clearCart));

module.exports = router;

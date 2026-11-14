const express = require('express');
const router = express.Router();

// 예전 서버 저장형 공유 장바구니. 인증 없이 테이블 ID만으로 읽기·삭제가 가능해 막는다.
// 메뉴 화면은 테이블 방 소켓 동기화(useSharedTableCart)를 쓴다.
router.use((req, res) =>
  res.status(410).json({ success: false, error: '더 이상 지원하지 않는 API입니다.' })
);
const cartController = require('../controllers/cartController');
const catchAsync = require('../utils/catchAsync');

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: 공유 장바구니 API (테이블 기반)
 */

/**
 * @swagger
 * /api/cart/{tableId}:
 *   get:
 *     tags: [Cart]
 *     summary: 특정 테이블의 공유 장바구니 조회
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 장바구니 데이터 반환
 */
router.get('/:tableId', catchAsync(cartController.getCart));

/**
 * @swagger
 * /api/cart/{tableId}:
 *   post:
 *     tags: [Cart]
 *     summary: 장바구니 아이템 추가/수정
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: 장바구니 업데이트 완료
 */
router.post('/:tableId', catchAsync(cartController.updateCart));

/**
 * @swagger
 * /api/cart/{tableId}:
 *   delete:
 *     tags: [Cart]
 *     summary: 특정 테이블의 장바구니 전체 초기화
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 장바구니 초기화 완료
 */
router.delete('/:tableId', catchAsync(cartController.clearCart));

module.exports = router;

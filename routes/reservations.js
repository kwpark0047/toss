const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const reservationsController = require('../controllers/reservationsController');

// [POST] 예약 요청 (고객)
router.post('/register', reservationsController.register);

// [GET] 특정 매장의 예약 리스트 조회 (관리자)
router.get('/store/:storeId', authMiddleware, reservationsController.getStoreReservations);

// [PATCH] 예약 상태 변경 (관리자)
router.patch('/:id/status', authMiddleware, reservationsController.updateStatus);

// [GET] 내 예약 상태 조회 (휴대폰 번호 기준)
router.get('/my/:phone', reservationsController.getMyReservations);

// [PATCH] 고객 본인 예약 취소
router.patch('/:id/cancel', reservationsController.cancelReservation);

module.exports = router;

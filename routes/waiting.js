const express = require('express');
const router = express.Router();
const waitingController = require('../controllers/waitingController');

// [GET] 특정 매장의 현재 대기 현황 조회
router.get('/store/:storeId/status', waitingController.getStoreStatus);

// [GET] 특정 매장의 대기 리스트 조회 (관리자)
router.get('/store/:storeId', waitingController.getStoreWaitingList);

// [POST] 대기 등록 (고객)
router.post('/register', waitingController.register);

// [PATCH] 대기 상태 변경 (관리자: 호출/입장/취소, 고객: 취소)
router.patch('/:id/status', waitingController.updateStatus);

// [GET] 내 대기 상태 조회 (휴대폰 번호 기준)
router.get('/my/:phone', waitingController.getMyWaiting);

module.exports = router;

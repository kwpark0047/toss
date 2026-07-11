const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const validate = require('../middleware/validate');
const { order: schema } = require('../utils/validationSchemas');

// 주문 생성 (공개)
router.post('/', validate(schema.create), orderController.createOrder);

// 고객용 실시간 웹 푸시 온보딩 토큰 전역 등록 (역방향 KDS 취소 알림용)
router.post('/:orderId/customer-token', orderController.registerCustomerToken);

// 고객 본인의 주문 내역 조회 (전화번호 또는 토스 키 기반)
router.get('/customer/history', orderController.getCustomerHistory);

// 매장별 상세 통계 (그래프용)
router.get('/store/:storeId/detailed-stats', authMiddleware, checkStorePermission('stats:read'), orderController.getDetailedStats);

// 매장별 주문 통계 (상단 카드용)
router.get('/store/:storeId/stats', authMiddleware, checkStorePermission('stats:read'), orderController.getStats);

// 매장별 주문 목록 조회
router.get('/store/:storeId', authMiddleware, checkStorePermission('order:read'), orderController.getStoreOrders);

// 주문 단일 상세 조회 (ID 기반)
router.get('/:id', orderController.getOrderDetails);

// 주문 상태 업데이트
router.put('/:id/status', authMiddleware, orderController.updateStatus);

// 주문 취소 (재고 복구 포함)
router.post('/:id/cancel', authMiddleware, orderController.cancelOrder);

// 주문 삭제
router.delete('/:id', authMiddleware, orderController.deleteOrder);

module.exports = router;

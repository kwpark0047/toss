const express = require('express');
const router = express.Router();
const kdsController = require('../controllers/kdsController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// ── KDS 주방 모니터 전용 API ──────────────────────────

// KDS 활성 조리중/대기중 주문 목록 조회
router.get('/stores/:storeId/orders', authMiddleware, checkStorePermission('orders:read'), kdsController.getActiveOrders);

// KDS 주문 조리 단계 상태 전이 (preparing, ready, completed)
router.post('/stores/:storeId/orders/:orderId/status', authMiddleware, checkStorePermission('orders:update'), kdsController.updateOrderStatus);

module.exports = router;

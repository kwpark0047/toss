const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission: checkPermission } = require('../middleware/storeAuth');
const {
    getInventory,
    adjustStock,
    setStock,
    getStockHistory,
    getStoreStockHistory,
    getLowStockAlerts
} = require('../controllers/inventoryController');

// 매장 재고 현황 목록
router.get('/store/:storeId', authMiddleware, checkPermission('menu:read'), getInventory);

// 매장 전체 재고 이력
router.get('/store/:storeId/history', authMiddleware, checkPermission('menu:read'), getStoreStockHistory);

// 저재고 알림 (빠른 조회)
router.get('/store/:storeId/alerts', authMiddleware, checkPermission('menu:read'), getLowStockAlerts);

// 상품별 재고 수동 조정 (입출고)
router.put('/products/:productId/stock', authMiddleware, checkPermission('menu:write'), adjustStock);

// 재고 절대값 설정 + 임계치 설정
router.put('/products/:productId/stock/set', authMiddleware, checkPermission('menu:write'), setStock);

// 상품별 재고 이력
router.get('/products/:productId/history', authMiddleware, checkPermission('menu:read'), getStockHistory);

module.exports = router;

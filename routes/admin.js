const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const storeSettingsController = require('../controllers/storeSettingsController');
const bulkSmsController = require('../controllers/bulkSmsController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// === [정산 API] ===
router.get('/stores/:storeId/settlements', authMiddleware, checkStorePermission('stats:read'), settlementController.getStoreSettlements);
router.post('/stores/:storeId/settlements/generate', authMiddleware, checkStorePermission('admin'), settlementController.generateSettlement);
router.patch('/stores/:storeId/settlements/:id/status', authMiddleware, checkStorePermission('admin'), settlementController.updateStatus);
router.post('/stores/:storeId/settlements/:id/tax-invoice', authMiddleware, checkStorePermission('settings:write'), settlementController.issueTaxInvoice);
router.get('/stores/:storeId/settlements/:id', authMiddleware, checkStorePermission('stats:read'), settlementController.getSettlementDetails);

// === [영수증 설정 API] ===
router.get('/stores/:storeId/receipt-settings', authMiddleware, checkStorePermission('settings:read'), storeSettingsController.getReceiptSettings);
router.put('/stores/:storeId/receipt-settings', authMiddleware, checkStorePermission('settings:write'), storeSettingsController.updateReceiptSettings);

// === [등급 설정 API] ===
router.get('/stores/:storeId/tier-settings', authMiddleware, checkStorePermission('settings:read'), storeSettingsController.getTierSettings);
router.post('/stores/:storeId/tier-settings', authMiddleware, checkStorePermission('settings:write'), storeSettingsController.upsertTierSetting);
router.delete('/stores/:storeId/tier-settings/:tierName', authMiddleware, checkStorePermission('settings:write'), storeSettingsController.deleteTierSetting);

// === [수수료율 설정 (최고관리자)] ===
router.put('/stores/:storeId/commission', authMiddleware, checkStorePermission('admin'), storeSettingsController.updateCommission);

// === [통합 Bulk SMS API (최고관리자 전용)] ===
router.get('/bulk-sms/filter-options', authMiddleware, bulkSmsController.getFilterOptions);
router.get('/bulk-sms/customers', authMiddleware, bulkSmsController.getFilteredCustomers);
router.post('/bulk-sms/send', authMiddleware, bulkSmsController.sendBulkSms);

module.exports = router;

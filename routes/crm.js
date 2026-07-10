const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * [CRM API 라우터]
 * 고객 분석 및 AI 스마트 마케팅 관련 엔드포인트를 관리합니다.
 */

// 1. 매장별 고객 분석 통계 조회
router.get('/store/:storeId/analysis', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  crmController.getCustomerAnalysis
);

// 2. 세그먼트별 고객 리스트 조회
router.get('/store/:storeId/segment/:segmentName', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  crmController.getSegmentCustomers
);

// 3. AI 스마트 마케팅 발송 (관리자/최고관리자 권한)
router.post('/store/:storeId/send-smart-sms', 
  authMiddleware, 
  checkStorePermission('settings:write'), 
  crmController.sendSmartMarketingSms
);

module.exports = router;

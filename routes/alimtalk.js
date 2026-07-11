const express = require('express');
const router = express.Router();
const alimtalkController = require('../controllers/alimtalkController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// ── 알림톡 모니터링 관리자 전용 API ──────────────────────────

// 실시간 알림톡 전송 이력 및 소모 비용 정산 통계 조회
router.get('/stores/:storeId/history', authMiddleware, checkStorePermission('stats:read'), alimtalkController.getHistory);

module.exports = router;

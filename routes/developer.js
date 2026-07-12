/**
 * developer.js — 개발자 포털 (API 키 / 웹훅 엔드포인트 관리)
 *
 * 매장 소유주(JWT 인증 + 매장 권한)가 자신의 매장에 대한 API 키를 발급/폐기하고
 * 웹훅 엔드포인트를 등록/관리한다. 발급 시 평문 키는 1회만 반환.
 */
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const developerController = require('../controllers/developerController');

// ── API 키 ────────────────────────────────────────────────────────────────
router.get('/stores/:storeId/api-keys', authMiddleware, developerController.listApiKeys);
router.post('/stores/:storeId/api-keys', authMiddleware, developerController.createApiKey);
router.delete('/stores/:storeId/api-keys/:keyId', authMiddleware, developerController.revokeApiKey);

// ── 웹훅 엔드포인트 ──────────────────────────────────────────────────────────
router.get('/stores/:storeId/webhooks', authMiddleware, developerController.listWebhooks);
router.post('/stores/:storeId/webhooks', authMiddleware, developerController.createWebhook);
router.delete('/stores/:storeId/webhooks/:id', authMiddleware, developerController.deleteWebhook);

// 최근 전송 로그
router.get('/stores/:storeId/webhook-deliveries', authMiddleware, developerController.getDeliveryLogs);

module.exports = router;

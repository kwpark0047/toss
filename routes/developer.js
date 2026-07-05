/**
 * developer.js — 개발자 포털 (API 키 / 웹훅 엔드포인트 관리)
 *
 * 매장 소유주(JWT 인증 + 매장 권한)가 자신의 매장에 대한 API 키를 발급/폐기하고
 * 웹훅 엔드포인트를 등록/관리한다. 발급 시 평문 키는 1회만 반환.
 */
const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const { generateApiKey } = require('../utils/apiKey');

// 매장 권한 확인 (소유주/매니저만)
async function ensureStorePermission(req, res) {
    const storeId = parseInt(req.params.storeId || req.body.store_id);
    if (!storeId) { res.status(400).json({ error: '매장 ID가 필요합니다.' }); return null; }
    if (req.user.role !== 'super_admin') {
        const role = await getStoreRole(req.user.id, storeId);
        if (!role) { res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' }); return null; }
    }
    return storeId;
}

// ── API 키 ────────────────────────────────────────────────────────────────
// 목록 (평문 키는 반환하지 않음)
router.get('/stores/:storeId/api-keys', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    const keys = await prisma.api_keys.findMany({
        where: { store_id: storeId },
        select: { id: true, name: true, key_prefix: true, scopes: true, last_used_at: true, revoked: true, created_at: true },
        orderBy: { created_at: 'desc' }
    });
    res.success(keys);
}));

// 발급 (평문 키 1회 반환)
router.post('/stores/:storeId/api-keys', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    const { name, scopes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '키 이름을 입력해주세요.' });
    const scopeStr = Array.isArray(scopes) ? scopes.join(',') : (scopes || 'read');
    const { plaintext, prefix, hash } = generateApiKey();
    const created = await prisma.api_keys.create({
        data: { store_id: storeId, name: name.trim(), key_prefix: prefix, key_hash: hash, scopes: scopeStr },
        select: { id: true, name: true, key_prefix: true, scopes: true, created_at: true }
    });
    // 평문 키는 이 응답에서만 노출
    res.success({ ...created, key: plaintext }, 'API 키가 발급되었습니다. 이 키는 다시 표시되지 않으니 안전하게 보관하세요.', 201);
}));

// 폐기
router.delete('/stores/:storeId/api-keys/:keyId', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    await prisma.api_keys.updateMany({
        where: { id: parseInt(req.params.keyId), store_id: storeId },
        data: { revoked: true }
    });
    res.success(null, 'API 키가 폐기되었습니다.');
}));

// ── 웹훅 엔드포인트 ──────────────────────────────────────────────────────────
router.get('/stores/:storeId/webhooks', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    const eps = await prisma.webhook_endpoints.findMany({
        where: { store_id: storeId },
        select: { id: true, url: true, events: true, active: true, created_at: true },
        orderBy: { created_at: 'desc' }
    });
    res.success(eps);
}));

router.post('/stores/:storeId/webhooks', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    const { url, events } = req.body;
    // 프로덕션은 https 강제, 개발 환경은 http(localhost 테스트) 허용
    const urlOk = process.env.NODE_ENV === 'production' ? /^https:\/\//.test(url) : /^https?:\/\//.test(url);
    if (!url || !urlOk) return res.status(400).json({ error: 'https URL을 입력해주세요.' });
    const eventStr = Array.isArray(events) ? events.join(',') : (events || '*');
    const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    const created = await prisma.webhook_endpoints.create({
        data: { store_id: storeId, url, secret, events: eventStr },
        select: { id: true, url: true, events: true, active: true, created_at: true }
    });
    // 서명 시크릿도 발급 시 1회 노출
    res.success({ ...created, secret }, '웹훅이 등록되었습니다. 서명 검증에 secret을 사용하세요.', 201);
}));

router.delete('/stores/:storeId/webhooks/:id', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    await prisma.webhook_endpoints.deleteMany({
        where: { id: parseInt(req.params.id), store_id: storeId }
    });
    res.success(null, '웹훅이 삭제되었습니다.');
}));

// 최근 전송 로그
router.get('/stores/:storeId/webhook-deliveries', authMiddleware, catchAsync(async (req, res) => {
    const storeId = await ensureStorePermission(req, res); if (!storeId) return;
    const rows = await prisma.webhook_deliveries.findMany({
        where: { endpoint: { store_id: storeId } },
        select: { id: true, event_type: true, status: true, attempts: true, response_status: true, last_error: true, created_at: true, delivered_at: true },
        orderBy: { created_at: 'desc' },
        take: 100
    });
    res.success(rows);
}));

module.exports = router;

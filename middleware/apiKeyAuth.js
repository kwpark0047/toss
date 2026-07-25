/**
 * apiKeyAuth.js — Open API v1 인증 미들웨어
 *
 * X-API-Key(또는 Bearer wm_live_...)를 검증해 req.apiClient에
 * { storeId, scopes, keyId }를 주입한다. write 스코프가 필요한 라우트는
 * requireScope('write')로 보호.
 */
const prisma = require('../config/prisma');
const { extractApiKey, hashApiKey } = require('../utils/apiKey');
const logger = require('../utils/logger');

const apiKeyAuth = async (req, res, next) => {
    const key = extractApiKey(req);
    if (!key) {
        return res.status(401).json({ error: 'unauthorized', message: 'API 키가 필요합니다. X-API-Key 헤더를 확인하세요.' });
    }
    try {
        const hash = hashApiKey(key);
        const rows = await prisma.$queryRawUnsafe(
            'SELECT id, store_id, scopes, revoked FROM api_keys WHERE key_hash = $1 LIMIT 1', hash
        );
        const rec = rows[0];
        if (!rec || rec.revoked) {
            return res.status(401).json({ error: 'unauthorized', message: '유효하지 않거나 폐기된 API 키입니다.' });
        }
        req.apiClient = {
            keyId: rec.id,
            storeId: rec.store_id,
            scopes: String(rec.scopes || 'read').split(',').map(s => s.trim()),
        };
        // last_used_at 갱신은 실패해도 요청 흐름 유지
        prisma.$executeRawUnsafe('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', rec.id)
            .catch(err => logger.warn(`[apiKey] last_used 갱신 실패: ${err.message}`));
        next();
    } catch (e) {
        logger.error(`[apiKey] 인증 오류: ${e.message}`);
        res.status(500).json({ error: 'internal_error' });
    }
};

/** 스코프 요구 (예: requireScope('write')) */
const requireScope = (scope) => (req, res, next) => {
    if (!req.apiClient?.scopes?.includes(scope)) {
        return res.status(403).json({ error: 'insufficient_scope', message: `이 작업에는 '${scope}' 스코프가 필요합니다.` });
    }
    next();
};

module.exports = { apiKeyAuth, requireScope };

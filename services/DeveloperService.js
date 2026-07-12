const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { generateApiKey } = require('../utils/apiKey');
const { validateWebhookUrl } = require('../utils/ssrfGuard');

class DeveloperService {
    /**
     * 매장 권한 확인 (소유주/매니저만)
     */
    async ensureStorePermission(user, storeId) {
        if (!storeId) {
            throw new AppError('매장 ID가 필요합니다.', 400);
        }
        if (user.role !== 'super_admin') {
            const { getStoreRole } = require('../middleware/storeAuth');
            const role = await getStoreRole(user.id, storeId);
            if (!role) {
                throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
            }
        }
        return storeId;
    }

    // ── API 키 ────────────────────────────────────────────────────────────
    /**
     * API 키 목록 조회 (평문 키는 반환하지 않음)
     */
    async listApiKeys(storeId) {
        return await prisma.api_keys.findMany({
            where: { store_id: storeId },
            select: {
                id: true, name: true, key_prefix: true, scopes: true,
                last_used_at: true, revoked: true, created_at: true
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * API 키 발급 (평문 키 1회 반환)
     */
    async createApiKey(storeId, name, scopes) {
        if (!name || !name.trim()) {
            throw new AppError('키 이름을 입력해주세요.', 400);
        }
        const scopeStr = Array.isArray(scopes) ? scopes.join(',') : (scopes || 'read');
        const { plaintext, prefix, hash } = generateApiKey();
        const created = await prisma.api_keys.create({
            data: {
                store_id: storeId,
                name: name.trim(),
                key_prefix: prefix,
                key_hash: hash,
                scopes: scopeStr
            },
            select: {
                id: true, name: true, key_prefix: true, scopes: true, created_at: true
            }
        });
        return { ...created, key: plaintext };
    }

    /**
     * API 키 폐기
     */
    async revokeApiKey(storeId, keyId) {
        await prisma.api_keys.updateMany({
            where: { id: parseInt(keyId), store_id: storeId },
            data: { revoked: true }
        });
    }

    // ── 웹훅 엔드포인트 ──────────────────────────────────────────────────
    /**
     * 웹훅 엔드포인트 목록 조회
     */
    async listWebhooks(storeId) {
        return await prisma.webhook_endpoints.findMany({
            where: { store_id: storeId },
            select: { id: true, url: true, events: true, active: true, created_at: true },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * 웹훅 엔드포인트 등록
     */
    async createWebhook(storeId, url, events) {
        const check = await validateWebhookUrl(url);
        if (!check.ok) {
            throw new AppError(check.reason, 400);
        }
        const eventStr = Array.isArray(events) ? events.join(',') : (events || '*');
        const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
        const created = await prisma.webhook_endpoints.create({
            data: { store_id: storeId, url, secret, events: eventStr },
            select: { id: true, url: true, events: true, active: true, created_at: true }
        });
        return { ...created, secret };
    }

    /**
     * 웹훅 엔드포인트 삭제
     */
    async deleteWebhook(storeId, webhookId) {
        await prisma.webhook_endpoints.deleteMany({
            where: { id: parseInt(webhookId), store_id: storeId }
        });
    }

    /**
     * 최근 전송 로그 조회
     */
    async getDeliveryLogs(storeId) {
        return await prisma.webhook_deliveries.findMany({
            where: { endpoint: { store_id: storeId } },
            select: {
                id: true, event_type: true, status: true, attempts: true,
                response_status: true, last_error: true, created_at: true, delivered_at: true
            },
            orderBy: { created_at: 'desc' },
            take: 100
        });
    }
}

module.exports = DeveloperService;

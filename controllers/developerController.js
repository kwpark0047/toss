const catchAsync = require('../utils/catchAsync');
const DeveloperService = require('../services/DeveloperService');

const developerService = new DeveloperService();

const developerController = {
    // ── API 키 ────────────────────────────────────────────────────────────
    // 목록
    listApiKeys: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        const keys = await developerService.listApiKeys(storeId);
        res.success(keys);
    }),

    // 발급
    createApiKey: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        const { name, scopes } = req.body;
        const result = await developerService.createApiKey(storeId, name, scopes);
        res.success(result, 'API 키가 발급되었습니다. 이 키는 다시 표시되지 않으니 안전하게 보관하세요.', 201);
    }),

    // 폐기
    revokeApiKey: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        await developerService.revokeApiKey(storeId, req.params.keyId);
        res.success(null, 'API 키가 폐기되었습니다.');
    }),

    // ── 웹훅 엔드포인트 ──────────────────────────────────────────────────
    listWebhooks: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        const eps = await developerService.listWebhooks(storeId);
        res.success(eps);
    }),

    createWebhook: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        const { url, events } = req.body;
        const result = await developerService.createWebhook(storeId, url, events);
        res.success(result, '웹훅이 등록되었습니다. 서명 검증에 secret을 사용하세요.', 201);
    }),

    deleteWebhook: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        await developerService.deleteWebhook(storeId, req.params.id);
        res.success(null, '웹훅이 삭제되었습니다.');
    }),

    // 최근 전송 로그
    getDeliveryLogs: catchAsync(async (req, res) => {
        const storeId = await developerService.ensureStorePermission(req.user, parseInt(req.params.storeId));
        const rows = await developerService.getDeliveryLogs(storeId);
        res.success(rows);
    })
};

module.exports = developerController;

jest.mock('../../../config/prisma', () => ({
    api_keys: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
    },
    webhook_endpoints: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
    },
    webhook_deliveries: {
        findMany: jest.fn(),
    },
}));
jest.mock('../../../utils/apiKey', () => ({
    generateApiKey: jest.fn(() => ({
        plaintext: 'wmk_test123456',
        prefix: 'wmk_test',
        hash: 'hashed_value',
    })),
}));
jest.mock('../../../utils/ssrfGuard', () => ({
    validateWebhookUrl: jest.fn(),
}));
jest.mock('../../../middleware/storeAuth', () => ({
    getStoreRole: jest.fn(),
}));

const DeveloperService = require('../../../services/DeveloperService');
const prisma = require('../../../config/prisma');
const { generateApiKey } = require('../../../utils/apiKey');
const { validateWebhookUrl } = require('../../../utils/ssrfGuard');
const { getStoreRole } = require('../../../middleware/storeAuth');

describe('DeveloperService', () => {
    let svc;

    beforeEach(() => {
        jest.clearAllMocks();
        svc = new DeveloperService();
    });

    describe('ensureStorePermission', () => {
        test('super_admin은 매장 ID만 있으면 통과', async () => {
            const result = await svc.ensureStorePermission({ role: 'super_admin' }, 1);
            expect(result).toBe(1);
        });

        test('매장 권한이 있는 사용자는 통과', async () => {
            getStoreRole.mockResolvedValue('owner');
            const result = await svc.ensureStorePermission({ id: 1, role: 'owner' }, 1);
            expect(result).toBe(1);
        });

        test('매장 권한이 없으면 403 에러', async () => {
            getStoreRole.mockResolvedValue(null);
            await expect(svc.ensureStorePermission({ id: 1, role: 'user' }, 1))
                .rejects.toThrow('해당 매장에 대한 권한이 없습니다.');
        });

        test('매장 ID 없으면 400 에러', async () => {
            await expect(svc.ensureStorePermission({ id: 1 }, null))
                .rejects.toThrow('매장 ID가 필요합니다.');
        });
    });

    describe('listApiKeys', () => {
        test('API 키 목록을 조회한다', async () => {
            prisma.api_keys.findMany.mockResolvedValue([
                { id: 1, name: '테스트키', key_prefix: 'wmk_' }
            ]);
            const result = await svc.listApiKeys(1);
            expect(result).toHaveLength(1);
        });
    });

    describe('createApiKey', () => {
        test('API 키를 발급하고 평문 키를 반환한다', async () => {
            prisma.api_keys.create.mockResolvedValue({
                id: 1, name: '테스트키', key_prefix: 'wmk_test', scopes: 'read'
            });
            const result = await svc.createApiKey(1, '테스트키', ['read']);
            expect(result.key).toBe('wmk_test123456');
            expect(generateApiKey).toHaveBeenCalled();
        });

        test('키 이름 없으면 400 에러', async () => {
            await expect(svc.createApiKey(1, '', ['read']))
                .rejects.toThrow('키 이름을 입력해주세요.');
        });
    });

    describe('revokeApiKey', () => {
        test('API 키를 폐기한다', async () => {
            prisma.api_keys.updateMany.mockResolvedValue({ count: 1 });
            await svc.revokeApiKey(1, 1);
            expect(prisma.api_keys.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1, store_id: 1 },
                data: { revoked: true }
            }));
        });
    });

    describe('listWebhooks', () => {
        test('웹훅 목록을 조회한다', async () => {
            prisma.webhook_endpoints.findMany.mockResolvedValue([
                { id: 1, url: 'https://example.com/hook', active: true }
            ]);
            const result = await svc.listWebhooks(1);
            expect(result).toHaveLength(1);
        });
    });

    describe('createWebhook', () => {
        test('웹훅을 등록한다', async () => {
            validateWebhookUrl.mockResolvedValue({ ok: true });
            prisma.webhook_endpoints.create.mockResolvedValue({
                id: 1, url: 'https://example.com/hook', events: '*', active: true
            });
            const result = await svc.createWebhook(1, 'https://example.com/hook', ['*']);
            expect(result.secret).toMatch(/^whsec_/);
        });

        test('잘못된 URL이면 400 에러', async () => {
            validateWebhookUrl.mockResolvedValue({ ok: false, reason: 'SSRF 위험' });
            await expect(svc.createWebhook(1, 'http://localhost', ['*']))
                .rejects.toThrow('SSRF 위험');
        });
    });

    describe('deleteWebhook', () => {
        test('웹훅을 삭제한다', async () => {
            prisma.webhook_endpoints.deleteMany.mockResolvedValue({ count: 1 });
            await svc.deleteWebhook(1, 1);
            expect(prisma.webhook_endpoints.deleteMany).toHaveBeenCalled();
        });
    });

    describe('getDeliveryLogs', () => {
        test('최근 전송 로그를 조회한다', async () => {
            prisma.webhook_deliveries.findMany.mockResolvedValue([
                { id: 1, event_type: 'order.created', status: 'success' }
            ]);
            const result = await svc.getDeliveryLogs(1);
            expect(result).toHaveLength(1);
        });
    });
});

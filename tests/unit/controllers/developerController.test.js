// developerController 단위 테스트
jest.mock('../../../utils/catchAsync', () => (fn) => fn);

const mockService = {
    ensureStorePermission: jest.fn(),
    listApiKeys: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
    listWebhooks: jest.fn(),
    createWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    getDeliveryLogs: jest.fn(),
};
jest.mock('../../../services/DeveloperService', () => {
    return jest.fn().mockImplementation(() => mockService);
});

const developerController = require('../../../controllers/developerController');

describe('developerController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: {}, query: {}, params: {}, user: { id: 10, role: 'owner' } };
        res = { json: jest.fn(), status: jest.fn().mockReturnThis(), success: jest.fn(), created: jest.fn() };
        next = jest.fn();
    });

    describe('listApiKeys', () => {
        test('API 키 목록을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.listApiKeys.mockResolvedValue([{ id: 1, name: 'Test Key' }]);
            await developerController.listApiKeys(req, res);
            expect(res.success).toHaveBeenCalledWith([{ id: 1, name: 'Test Key' }]);
        });
    });

    describe('createApiKey', () => {
        test('API 키를 발급한다', async () => {
            req.params.storeId = '1';
            req.body = { name: 'My API Key', scopes: ['read'] };
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.createApiKey.mockResolvedValue({ key: 'sk_123', name: 'My API Key' });
            await developerController.createApiKey(req, res);
            expect(res.created).toHaveBeenCalled();
        });
    });

    describe('revokeApiKey', () => {
        test('API 키를 폐기한다', async () => {
            req.params.storeId = '1';
            req.params.keyId = 'k1';
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.revokeApiKey.mockResolvedValue();
            await developerController.revokeApiKey(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('listWebhooks', () => {
        test('웹훅 목록을 조회한다', async () => {
            req.params.storeId = '1';
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.listWebhooks.mockResolvedValue([]);
            await developerController.listWebhooks(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('createWebhook', () => {
        test('웹훅을 등록한다', async () => {
            req.params.storeId = '1';
            req.body = { url: 'https://example.com/hook', events: ['order.created'] };
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.createWebhook.mockResolvedValue({ id: 1 });
            await developerController.createWebhook(req, res);
            expect(res.created).toHaveBeenCalled();
        });
    });

    describe('deleteWebhook', () => {
        test('웹훅을 삭제한다', async () => {
            req.params.storeId = '1';
            req.params.id = 'w1';
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.deleteWebhook.mockResolvedValue();
            await developerController.deleteWebhook(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });

    describe('getDeliveryLogs', () => {
        test('전송 로그를 조회한다', async () => {
            req.params.storeId = '1';
            mockService.ensureStorePermission.mockResolvedValue(1);
            mockService.getDeliveryLogs.mockResolvedValue([{ status: 'success' }]);
            await developerController.getDeliveryLogs(req, res);
            expect(res.success).toHaveBeenCalled();
        });
    });
});

const request = require('supertest');
const { app } = require('../../app');
const Store = require('../../repositories/Store');

let mockUser = { id: 1, name: '홍길동', role: 'user' };

jest.mock('../../middleware/auth', () => {
    const mockAuthMiddleware = (req, res, next) => {
        if (!mockUser) {
            return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
        }
        req.user = mockUser;
        next();
    };

    const mockOptionalAuth = (req, res, next) => {
        req.user = mockUser;
        next();
    };

    const mockAdminOnly = (req, res, next) => {
        if (!mockUser || mockUser.role !== 'super_admin') {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        next();
    };

    const mockAuthModule = mockAuthMiddleware;
    mockAuthModule.authMiddleware = mockAuthMiddleware;
    mockAuthModule.optionalAuth = mockOptionalAuth;
    mockAuthModule.adminOnly = mockAdminOnly;

    return mockAuthModule;
});

jest.mock('../../middleware/storeAuth', () => {
    return {
        checkStorePermission: (permission) => (req, res, next) => {
            req.storeId = req.params.storeId ? parseInt(req.params.storeId) : 1;
            req.storeRole = 'owner';
            next();
        },
        getStoreRole: jest.fn(() => 'owner')
    };
});

jest.mock('../../repositories/Store');

describe('Legal Integration Tests', () => {
    const baseUrl = '/api/legal';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 1, name: '홍길동', role: 'user' };
    });

    describe('GET /stores/:storeId', () => {
        it('should get store disclosures successfully', async () => {
            Store.findById.mockResolvedValue({
                id: 1,
                name: '맛있는 식당',
                business_name: '맛있는 식당 주식회사',
                business_number: '120-81-12342', // Valid business number
                ceo_name: '홍길동',
                business_address: '서울시 강남구',
                phone: '02-123-4567',
                mail_order_number: '서울강남-2024-0001',
                pg_company: '토스페이먼츠',
                pg_business_number: '214-88-00591'
            });

            const response = await request(app).get(`${baseUrl}/stores/1`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.store_name).toBe('맛있는 식당');
            expect(response.body.data.business_number_valid).toBe(true);
        });

        it('should return 404 if store is not found', async () => {
            Store.findById.mockResolvedValue(null);

            const response = await request(app).get(`${baseUrl}/stores/999`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /stores/:storeId/terms', () => {
        it('should get terms of service successfully', async () => {
            Store.findById.mockResolvedValue({ id: 1, name: '식당', terms_of_service: '이용약관 테스트' });

            const response = await request(app).get(`${baseUrl}/stores/1/terms`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('이용약관 테스트');
        });

        it('should return default terms when terms_of_service is null', async () => {
            Store.findById.mockResolvedValue({ id: 1, name: '식당', terms_of_service: null });

            const response = await request(app).get(`${baseUrl}/stores/1/terms`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toContain('식당 서비스 이용약관');
        });
    });

    describe('GET /stores/:storeId/privacy', () => {
        it('should get privacy policy successfully', async () => {
            Store.findById.mockResolvedValue({ id: 1, name: '식당', privacy_policy: '개인정보처리방침 테스트' });

            const response = await request(app).get(`${baseUrl}/stores/1/privacy`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('개인정보처리방침 테스트');
        });
    });

    describe('GET /stores/:storeId/refund', () => {
        it('should get refund policy successfully', async () => {
            Store.findById.mockResolvedValue({ id: 1, refund_policy: '환불취소규정 테스트' });

            const response = await request(app).get(`${baseUrl}/stores/1/refund`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe('환불취소규정 테스트');
        });
    });

    describe('GET /admin/stores/:storeId', () => {
        it('should return full legal disclosures for admin', async () => {
            Store.findById.mockResolvedValue({
                id: 1,
                name: '맛있는 식당',
                business_number: '120-81-12342'
            });

            const response = await request(app).get(`${baseUrl}/admin/stores/1`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.business_number_valid).toBe(true);
        });
    });

    describe('PUT /admin/stores/:storeId', () => {
        it('should update store legal info successfully', async () => {
            Store.updateLegalInfo.mockResolvedValue({ id: 1, business_name: '신규상호' });

            const response = await request(app)
                .put(`${baseUrl}/admin/stores/1`)
                .send({
                    business_name: '신규상호',
                    business_number: '120-81-12342', // Valid business number
                    mail_order_number: '경기수원-2024-0012'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.business_name).toBe('신규상호');
        });

        it('should return 400 for invalid business number format', async () => {
            const response = await request(app)
                .put(`${baseUrl}/admin/stores/1`)
                .send({
                    business_number: '111-22-33333' // Invalid checksum
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('유효하지 않은 사업자등록번호입니다');
        });

        it('should return 400 for invalid mail order number format', async () => {
            const response = await request(app)
                .put(`${baseUrl}/admin/stores/1`)
                .send({
                    mail_order_number: 'invalid-format'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('통신판매업신고번호 형식이 올바르지 않습니다');
        });
    });

    describe('POST /admin/stores/:storeId/verify-business', () => {
        it('should verify correct business number', async () => {
            const response = await request(app)
                .post(`${baseUrl}/admin/stores/1/verify-business`)
                .send({ business_number: '120-81-12342' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.valid).toBe(true);
            expect(response.body.data.message).toBe('유효한 사업자등록번호입니다.');
        });

        it('should return invalid for incorrect business number', async () => {
            const response = await request(app)
                .post(`${baseUrl}/admin/stores/1/verify-business`)
                .send({ business_number: '111-22-33333' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.valid).toBe(false);
            expect(response.body.data.message).toContain('국세청 알고리즘 검증 실패');
        });
    });
});

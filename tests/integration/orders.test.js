const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');

let mockUser = { id: 1, name: '장사장', role: 'user' };

// ── 인증 및 권한 미들웨어 모의 ──────────────────────────────────────────────────
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

// ── Prisma 데이터베이스 어댑터 모의 ────────────────────────────────────────────────
jest.mock('../../config/prisma', () => {
    return {
        orders: {
            update: jest.fn(),
        },
        store_customers: {
            updateMany: jest.fn(),
        }
    };
});

describe('Orders Onboarding Integration Tests', () => {
    const baseUrl = '/api/orders';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 1, name: '장사장', role: 'user' };
    });

    describe('POST /orders/:orderId/customer-token', () => {
        it('should fail if token parameter is missing', async () => {
            const res = await request(app)
                .post(`${baseUrl}/101/customer-token`)
                .send({})
                .expect(400);

            expect(res.body.error).toBe('invalid_request');
            expect(res.body.message).toContain('토큰이 제공되지 않았습니다.');
        });

        it('should update order customer_fcm_token and sync with store_customers in DB', async () => {
            const mockToken = 'fcm_mock_client_token_xyz_12345';
            
            prisma.orders.update.mockResolvedValue({
                id: 101,
                store_id: 1,
                order_number: '20260711-0001',
                customer_phone: 'U2FsdGVkX1+WqK4pS0+k7A==', // 01012345678 복호화 대응
                customer_fcm_token: mockToken
            });

            prisma.store_customers.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post(`${baseUrl}/101/customer-token`)
                .send({ token: mockToken })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('웹 푸시 온보딩 토큰이 성공적으로 등록되었습니다.');

            expect(prisma.orders.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 101 },
                data: { customer_fcm_token: mockToken }
            }));

            expect(prisma.store_customers.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { 
                    store_id: 1, 
                    customer_phone: 'U2FsdGVkX1+WqK4pS0+k7A==' 
                },
                data: { fcm_token: mockToken }
            }));
        });
    });
});

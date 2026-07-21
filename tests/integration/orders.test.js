// ── 모의 객체 선언 (jest.mock 팩토리가 참조하므로 최상단에서 먼저 초기화) ──────────
const mockOrderRepository = {
    findById: jest.fn(),
    findByCustomer: jest.fn(),
    findByStoreId: jest.fn(),
    getStats: jest.fn(),
    getDetailedStats: jest.fn(),
    delete: jest.fn()
};

const mockOrderServiceInstance = {
    createOrder: jest.fn(),
    updateStatus: jest.fn(),
    cancelOrder: jest.fn()
};

let mockUser = { id: 1, name: '장사장', role: 'user' };

const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');

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

// ── 매장 권한 미들웨어 모의 ──────────────────────────────────────────────────
jest.mock('../../middleware/storeAuth', () => ({
    checkStorePermission: (permission) => (req, res, next) => {
        req.storeId = parseInt(req.params.storeId || req.query.store_id || req.body.store_id || 1);
        req.storeRole = 'owner';
        next();
    },
    getStoreRole: jest.fn().mockResolvedValue('owner')
}));

// ── 검증 미들웨어 모의 (실제 Joi 검증 수행, 테스트 신뢰성 확보) ──────────────────
jest.mock('../../middleware/validate', () => {
    const Joi = require('joi');
    const validate = (schema) => (req, res, next) => {
        if (Joi.isSchema(schema)) {
            const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
            if (error) {
                const errorMessage = error.details.map((d) => d.message).join(', ');
                return res.status(400).json({ error: 'Validation Error', message: errorMessage, details: error.details });
            }
            req.body = value;
            return next();
        }
        const validations = [];
        if (schema.body) validations.push({ type: 'body', data: req.body, schema: schema.body });
        if (schema.query) validations.push({ type: 'query', data: req.query, schema: schema.query });
        if (schema.params) validations.push({ type: 'params', data: req.params, schema: schema.params });
        for (const v of validations) {
            const { error, value } = v.schema.validate(v.data, { abortEarly: false, stripUnknown: true });
            if (error) {
                const errorMessage = error.details.map((d) => d.message).join(', ');
                return res.status(400).json({ error: `Validation Error (${v.type})`, message: errorMessage, details: error.details });
            }
            req[v.type] = value;
        }
        next();
    };
    return validate;
});

// ── Order 레포지토리 모의 (객체는 파일 최상단에서 선언됨) ─────────────────────
jest.mock('../../repositories/Order', () => mockOrderRepository);

// ── OrderService 모의 (인스턴스는 파일 최상단에서 선언됨) ───────────────────
jest.mock('../../services/OrderService', () => {
    return jest.fn().mockImplementation(() => mockOrderServiceInstance);
});

// ── Prisma 모의 (기존 customer-token 테스트용) ─────────────────────────────────
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

describe('Orders Integration Tests', () => {
    const baseUrl = '/api/orders';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 1, name: '장사장', role: 'user' };
        // OrderService 인스턴스 메서드도 클리어
        Object.values(mockOrderServiceInstance).forEach(fn => fn.mockReset?.());
    });

    describe('GET /orders/:id - 주문 단일 상세 조회', () => {
        it('should return order details when found', async () => {
            const mockOrder = {
                id: 101,
                store_id: 1,
                order_number: '20260720-0001',
                status: 'confirmed',
                total_amount: 25000,
                items: [
                    { id: 1, product_id: 10, quantity: 2, product: { name: '아메리카노', price: 4500 } }
                ],
                created_at: new Date().toISOString()
            };
            mockOrderRepository.findById.mockResolvedValue(mockOrder);

            const res = await request(app)
                .get(`${baseUrl}/101`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(101);
            expect(res.body.data.order_number).toBe('20260720-0001');
            expect(mockOrderRepository.findById).toHaveBeenCalledWith('101');
        });

        it('should return 404 when order not found', async () => {
            mockOrderRepository.findById.mockResolvedValue(null);

            const res = await request(app)
                .get(`${baseUrl}/999`)
                .expect(404);

            expect(res.body.error).toBe('주문을 찾을 수 없습니다');
        });
    });

    describe('GET /orders/customer/history - 고객 주문 내역 조회', () => {
        it('should return 400 when phone and toss_user_key are both missing', async () => {
            const res = await request(app)
                .get(`${baseUrl}/customer/history`)
                .expect(400);

            expect(res.body.error).toBe('조회에 필요한 정보가 부족합니다.');
        });

        it('should return orders when phone is provided', async () => {
            const mockOrders = [
                { id: 101, order_number: '20260720-0001', status: 'completed', total_amount: 25000, created_at: new Date().toISOString() },
                { id: 102, order_number: '20260719-0002', status: 'completed', total_amount: 18000, created_at: new Date().toISOString() }
            ];
            mockOrderRepository.findByCustomer.mockResolvedValue(mockOrders);

            const res = await request(app)
                .get(`${baseUrl}/customer/history?phone=01012345678`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(mockOrderRepository.findByCustomer).toHaveBeenCalledWith('01012345678', undefined);
        });

        it('should return orders when toss_user_key is provided', async () => {
            const mockOrders = [
                { id: 103, order_number: '20260718-0001', status: 'completed', total_amount: 30000, created_at: new Date().toISOString() }
            ];
            mockOrderRepository.findByCustomer.mockResolvedValue(mockOrders);

            const res = await request(app)
                .get(`${baseUrl}/customer/history?toss_user_key=toss_key_abc123`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(mockOrderRepository.findByCustomer).toHaveBeenCalledWith(undefined, 'toss_key_abc123');
        });
    });

    describe('GET /orders/store/:storeId - 매장별 주문 목록 조회 (인증 필요)', () => {
        it('should return store orders with pagination', async () => {
            const mockOrders = [
                { id: 101, order_number: '20260720-0001', status: 'confirmed', total_amount: 25000, created_at: new Date().toISOString() },
                { id: 102, order_number: '20260720-0002', status: 'preparing', total_amount: 18000, created_at: new Date().toISOString() }
            ];
            mockOrderRepository.findByStoreId.mockResolvedValue(mockOrders);

            const res = await request(app)
                .get(`${baseUrl}/store/1?page=1&limit=20`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(mockOrderRepository.findByStoreId).toHaveBeenCalledWith('1', undefined, undefined);
        });

        it('should filter by status when provided', async () => {
            const mockOrders = [
                { id: 101, order_number: '20260720-0001', status: 'completed', total_amount: 25000 }
            ];
            mockOrderRepository.findByStoreId.mockResolvedValue(mockOrders);

            const res = await request(app)
                .get(`${baseUrl}/store/1?status=completed`)
                .expect(200);

            expect(res.body.data).toHaveLength(1);
            expect(mockOrderRepository.findByStoreId).toHaveBeenCalledWith('1', 'completed', undefined);
        });

        it('should return empty array when no orders', async () => {
            mockOrderRepository.findByStoreId.mockResolvedValue([]);

            const res = await request(app)
                .get(`${baseUrl}/store/999`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
        });
    });

    describe('GET /orders/store/:storeId/stats - 매장 통계 조회 (인증 필요)', () => {
        it('should return stats for store', async () => {
            const mockStats = {
                today: { orders: 42, revenue: 850000, avg_order_value: 20238 },
                this_month: { orders: 1250, revenue: 28500000, avg_order_value: 22800 }
            };
            mockOrderRepository.getStats.mockResolvedValue(mockStats);

            const res = await request(app)
                .get(`${baseUrl}/store/1/stats`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.today.orders).toBe(42);
            expect(res.body.data.this_month.revenue).toBe(28500000);
            expect(mockOrderRepository.getStats).toHaveBeenCalledWith('1', undefined, undefined);
        });

        it('should pass date range when provided', async () => {
            mockOrderRepository.getStats.mockResolvedValue({ today: {}, this_month: {} });

            await request(app)
                .get(`${baseUrl}/store/1/stats?start_date=2026-07-01&end_date=2026-07-20`)
                .expect(200);

            expect(mockOrderRepository.getStats).toHaveBeenCalledWith('1', '2026-07-01', '2026-07-20');
        });
    });

    describe('GET /orders/store/:storeId/detailed-stats - 상세 통계 조회 (인증 필요)', () => {
        it('should return 400 when start_date or end_date is missing', async () => {
            const res = await request(app)
                .get(`${baseUrl}/store/1/detailed-stats`)
                .expect(400);

            expect(res.body.error).toBe('시작일과 종료일이 필요합니다.');
        });

        it('should return detailed stats when dates provided', async () => {
            const mockStats = {
                hourly: [
                    { hour: 12, orders: 15, revenue: 375000 },
                    { hour: 13, orders: 22, revenue: 550000 }
                ],
                by_category: [
                    { category: '커피', orders: 50, revenue: 1250000 },
                    { category: '디저트', orders: 30, revenue: 750000 }
                ]
            };
            mockOrderRepository.getDetailedStats.mockResolvedValue(mockStats);

            const res = await request(app)
                .get(`${baseUrl}/store/1/detailed-stats?start_date=2026-07-01&end_date=2026-07-20`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.hourly).toHaveLength(2);
            expect(res.body.data.by_category).toHaveLength(2);
            expect(mockOrderRepository.getDetailedStats).toHaveBeenCalledWith('1', '2026-07-01', '2026-07-20');
        });
    });

    describe('PUT /orders/:id/status - 주문 상태 업데이트 (인증 필요)', () => {
        it('should update order status successfully', async () => {
            const mockUpdatedOrder = {
                id: 101,
                order_number: '20260720-0001',
                status: 'preparing',
                total_amount: 25000,
                updated_at: new Date().toISOString()
            };
            mockOrderServiceInstance.updateStatus.mockResolvedValue(mockUpdatedOrder);

            const res = await request(app)
                .put(`${baseUrl}/101/status`)
                .send({ status: 'preparing', staff_id: 5 })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.order.status).toBe('preparing');
            expect(mockOrderServiceInstance.updateStatus).toHaveBeenCalledWith('101', 'preparing', 5);
        });

        it('should update order status with default handling when status is missing', async () => {
            const mockUpdatedOrder = {
                id: 101,
                order_number: '20260720-0001',
                status: 'pending',
                total_amount: 25000,
                updated_at: new Date().toISOString()
            };
            mockOrderServiceInstance.updateStatus.mockResolvedValue(mockUpdatedOrder);

            const res = await request(app)
                .put(`${baseUrl}/101/status`)
                .send({ staff_id: 5 })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(mockOrderServiceInstance.updateStatus).toHaveBeenCalledWith('101', undefined, 5);
        });
    });

    describe('POST /orders/:id/cancel - 주문 취소 (인증 필요)', () => {
        it('should cancel order successfully', async () => {
            const mockResult = {
                success: true,
                order: { id: 101, status: 'cancelled' },
                message: '주문이 취소되었습니다.'
            };
            mockOrderServiceInstance.cancelOrder.mockResolvedValue(mockResult);

            const res = await request(app)
                .post(`${baseUrl}/101/cancel`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.order.status).toBe('cancelled');
            expect(mockOrderServiceInstance.cancelOrder).toHaveBeenCalledWith('101', 1, 'user');
        });
    });

    describe('DELETE /orders/:id - 주문 삭제 (인증 필요)', () => {
        it('should delete order successfully', async () => {
            mockOrderRepository.delete.mockResolvedValue({ id: 101, deleted: true });

            const res = await request(app)
                .delete(`${baseUrl}/101`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('주문이 삭제되었습니다.');
            expect(mockOrderRepository.delete).toHaveBeenCalledWith(101);
        });
    });

    describe('POST /orders - 주문 생성 (검증 미들웨어 필요)', () => {
        it('should create order successfully', async () => {
            const mockOrder = {
                id: 101,
                order_number: '20260720-0001',
                store_id: 1,
                status: 'pending',
                total_amount: 25000,
                items: [
                    { product_id: 10, quantity: 2, product: { name: '아메리카노', price: 4500 } }
                ],
                created_at: new Date().toISOString()
            };
            mockOrderServiceInstance.createOrder.mockResolvedValue(mockOrder);

            const orderData = {
                store_id: 1,
                items: [
                    { product_id: 10, product_name: '아메리카노', quantity: 2, price: 4500 }
                ],
                total_amount: 25000,
                payment_method: 'card',
                table_number: '3',
                is_takeout: false
            };

            const res = await request(app)
                .post(`${baseUrl}`)
                .send(orderData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(101);
            expect(res.body.data.order_number).toMatch(/^\d{8}-\d{4}$/);
            expect(mockOrderServiceInstance.createOrder).toHaveBeenCalled();
        });

        it('should return 400 when required fields missing', async () => {
            const res = await request(app)
                .post(`${baseUrl}`)
                .send({ store_id: 1 }) // items, total_amount, payment_method 누락
                .expect(400);

            expect(res.body.error).toBe('Validation Error');
        });
    });

    // ── 기존 테스트 유지: POST /orders/:orderId/customer-token ─────────────────
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
                customer_phone: 'U2FsdGVkX1+WqK4pS0+k7A==',
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
const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');
const OrderRepository = require('../../repositories/Order');

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
    const mockPrisma = {
        stores: {
            findMany: jest.fn(),
        },
        staff: {
            findMany: jest.fn(),
        },
        getQueryLogs: jest.fn(() => [
            { id: 'q1', query: 'SELECT * FROM stores', params: '[]', duration: 15, timestamp: new Date() },
            { id: 'q2', query: 'UPDATE print_jobs SET status = DONE', params: '[1]', duration: 120, timestamp: new Date() }
        ])
    };
    return mockPrisma;
});

// ── Order 레포지토리 모의 ──────────────────────────────────────────────────────
jest.mock('../../repositories/Order', () => {
    return {
        getMultiStoreStats: jest.fn(),
    };
});

describe('Franchise Supervisor Analytics Integration Tests', () => {
    const baseUrl = '/api/analytics';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 1, name: '장사장', role: 'user' };
    });

    describe('GET /analytics/multi-store', () => {
        it('should return empty stats if user owns no stores', async () => {
            prisma.stores.findMany.mockResolvedValue([]);
            prisma.staff.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get(`${baseUrl}/multi-store?start_date=2026-07-01&end_date=2026-07-11`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.store_count).toBe(0);
            expect(res.body.data.summary.total_sales).toBe(0);
            expect(res.body.data.stores).toHaveLength(0);
        });

        it('should compile owned store IDs and return consolidated aggregates', async () => {
            // 사용자가 소유한 매장 가상 조회 설정
            prisma.stores.findMany.mockResolvedValue([
                { id: 10 },
                { id: 20 }
            ]);
            prisma.staff.findMany.mockResolvedValue([]);

            // 다점포 통계 레포지토리 응답 모의
            OrderRepository.getMultiStoreStats.mockResolvedValue({
                summary: { total_sales: 1200000, total_orders: 80, store_count: 2 },
                stores: [
                    { store_id: 10, store_name: '연남 본점', total_sales: 800000, total_orders: 50 },
                    { store_id: 20, store_name: '강남 직영점', total_sales: 400000, total_orders: 30 }
                ]
            });

            const res = await request(app)
                .get(`${baseUrl}/multi-store?start_date=2026-07-01&end_date=2026-07-11`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.total_sales).toBe(1200000);
            expect(res.body.data.summary.total_orders).toBe(80);
            expect(res.body.data.summary.store_count).toBe(2);
            expect(res.body.data.stores).toHaveLength(2);
            expect(res.body.data.stores[0].store_name).toBe('연남 본점');

            expect(OrderRepository.getMultiStoreStats).toHaveBeenCalledWith(
                [10, 20],
                '2026-07-01',
                '2026-07-11'
            );
        });
    });

    describe('GET /analytics/db-profile', () => {
        it('should block non-super_admin users with 403 Forbidden', async () => {
            // 일반 사업자 권한 상태 설정
            mockUser = { id: 1, name: '장사장', role: 'owner' };

            const res = await request(app)
                .get(`${baseUrl}/db-profile`)
                .expect(403);

            expect(res.body.error).toBe('unauthorized');
            expect(res.body.message).toContain('원장 프로파일러 권한이 없습니다');
        });

        it('should return telemetry query logs and aggregates for super_admin', async () => {
            // 슈퍼어드민 권한 상태 설정
            mockUser = { id: 999, name: '최고관리자', role: 'super_admin' };

            const res = await request(app)
                .get(`${baseUrl}/db-profile`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.total_queries).toBe(2);
            expect(res.body.data.summary.avg_latency_ms).toBe(68); // (15 + 120) / 2 = 67.5 -> 68ms
            expect(res.body.data.summary.max_latency_ms).toBe(120);
            expect(res.body.data.summary.slow_queries_count).toBe(1); // 120ms >= 100ms
            expect(res.body.data.summary.slow_query_ratio).toBe(50); // 1/2 = 50%
            expect(res.body.data.logs).toHaveLength(2);
            expect(res.body.data.logs[0].query).toBe('SELECT * FROM stores');
            
            expect(prisma.getQueryLogs).toHaveBeenCalled();
        });
    });
});

const request = require('supertest');
const { app } = require('../../app');
const prisma = require('../../config/prisma');
const Store = require('../../repositories/Store');
const Order = require('../../repositories/Order');

let mockUser = { id: 10, name: '백종원', role: 'owner' };

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

// ── 레포지토리 레이어 모의 ──────────────────────────────────────────────────
jest.mock('../../repositories/Store', () => {
    return {
        findByUserId: jest.fn(),
        findAll: jest.fn()
    };
});

jest.mock('../../repositories/Order', () => {
    return {
        getMultiStoreStats: jest.fn()
    };
});

describe('Multi-Store Analytics Integration Tests', () => {
    const baseUrl = '/api/analytics/multi-store';

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 10, name: '백종원', role: 'owner' };
    });

    it('should fail if start_date or end_date is missing', async () => {
        const res = await request(app)
            .get(baseUrl)
            .expect(400);

        expect(res.body.error).toContain('시작일과 종료일이 필요합니다.');
    });

    it('should return empty summary if the user has no registered stores', async () => {
        Store.findByUserId.mockResolvedValue([]);

        const res = await request(app)
            .get(`${baseUrl}?start_date=2026-07-01&end_date=2026-07-11`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.summary.store_count).toBe(0);
        expect(res.body.data.summary.total_sales).toBe(0);
        expect(res.body.data.stores).toHaveLength(0);
    });

    it('should successfully aggregate sales statistics across multiple stores', async () => {
        Store.findByUserId.mockResolvedValue([
            { id: 1, name: '홍콩반점 역삼점' },
            { id: 2, name: '빽다방 강남점' }
        ]);

        Order.getMultiStoreStats.mockResolvedValue({
            summary: { total_sales: 450000, total_orders: 45, store_count: 2 },
            stores: [
                { store_id: 1, store_name: '홍콩반점 역삼점', total_sales: 300000, total_orders: 20 },
                { store_id: 2, store_name: '빽다방 강남점', total_sales: 150000, total_orders: 25 }
            ]
        });

        const res = await request(app)
            .get(`${baseUrl}?start_date=2026-07-01&end_date=2026-07-11`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.summary.store_count).toBe(2);
        expect(res.body.data.summary.total_sales).toBe(450000);
        expect(res.body.data.stores).toHaveLength(2);
        expect(res.body.data.stores[0].total_sales).toBe(300000);
        expect(Store.findByUserId).toHaveBeenCalledWith(10);
        expect(Order.getMultiStoreStats).toHaveBeenCalledWith([1, 2], '2026-07-01', '2026-07-11');
    });

    it('should query all stores in the platform if the request is from a super_admin', async () => {
        mockUser = { id: 999, name: '시스템총괄', role: 'super_admin' };

        Store.findAll.mockResolvedValue([
            { id: 1, name: '홍콩반점 역삼점' },
            { id: 2, name: '빽다방 강남점' },
            { id: 3, name: '롤링파스타 신촌점' }
        ]);

        Order.getMultiStoreStats.mockResolvedValue({
            summary: { total_sales: 600000, total_orders: 60, store_count: 3 },
            stores: [
                { store_id: 1, store_name: '홍콩반점 역삼점', total_sales: 300000, total_orders: 20 },
                { store_id: 2, store_name: '빽다방 강남점', total_sales: 150000, total_orders: 25 },
                { store_id: 3, store_name: '롤링파스타 신촌점', total_sales: 150000, total_orders: 15 }
            ]
        });

        const res = await request(app)
            .get(`${baseUrl}?start_date=2026-07-01&end_date=2026-07-11`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.summary.store_count).toBe(3);
        expect(Store.findAll).toHaveBeenCalled();
        expect(Order.getMultiStoreStats).toHaveBeenCalledWith([1, 2, 3], '2026-07-01', '2026-07-11');
    });
});

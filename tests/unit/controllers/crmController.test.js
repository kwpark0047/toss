jest.mock('../../../config/prisma', () => ({
    store_customers: {
        findMany: jest.fn(),
    },
    stores: {
        findUnique: jest.fn(),
    },
}));
jest.mock('../../../services/aiService', () => ({
    translateText: jest.fn(),
}));
jest.mock('../../../utils/errorHandler', () => ({
    AppError: class AppError extends Error {
        constructor(msg, status) { super(msg); this.status = status; this.isOperational = true; }
    },
}));

const crmController = require('../../../controllers/crmController');
const prisma = require('../../../config/prisma');
const aiService = require('../../../services/aiService');

describe('crmController', () => {
    const mockRes = () => {
        const res = {};
        res.success = jest.fn().mockReturnValue(res);
        return res;
    };
    const mockNext = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('classifySegment', () => {
        // classifySegment is not exported, test via getCustomerAnalysis

        test('Champions 세그먼트 분류', async () => {
            const now = new Date();
            const recentDate = new Date(now - 3 * 86400000); // 3일 전
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, last_visited_at: recentDate, visit_count: 6, total_spent: 60000, customer_phone: '01012345678' },
            ]);

            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                mockRes(),
                mockNext
            );

            const res = mockRes();
            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                res,
                mockNext
            );
            expect(res.success).toHaveBeenCalled();
            const callData = res.success.mock.calls[0][0];
            expect(callData.summary.segments.Champions).toBe(1);
        });

        test('Lost 세그먼트 분류 (90일+ 미방문)', async () => {
            const oldDate = new Date(Date.now() - 120 * 86400000);
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 2, last_visited_at: oldDate, visit_count: 3, total_spent: 25000 },
            ]);

            const res = mockRes();
            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.summary.segments.Lost).toBe(1);
        });

        test('New 세그먼트 분류 (방문 1회)', async () => {
            const recentDate = new Date(Date.now() - 2 * 86400000);
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 3, last_visited_at: recentDate, visit_count: 1, total_spent: 5000 },
            ]);

            const res = mockRes();
            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.summary.segments.New).toBe(1);
        });
    });

    describe('getCustomerAnalysis', () => {
        test('총 매출과 평균 지출을 계산한다', async () => {
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, total_spent: 30000, last_visited_at: new Date(), visit_count: 5 },
                { id: 2, total_spent: 10000, last_visited_at: new Date(), visit_count: 2 },
            ]);

            const res = mockRes();
            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.summary.total_customers).toBe(2);
            expect(data.summary.total_revenue).toBe(40000);
            expect(data.summary.avg_spent_per_customer).toBe(20000);
        });

        test('에러 시 next(err) 호출', async () => {
            prisma.store_customers.findMany.mockRejectedValue(new Error('DB error'));
            await crmController.getCustomerAnalysis(
                { params: { storeId: '1' } },
                mockRes(),
                mockNext
            );
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getSegmentCustomers', () => {
        test('특정 세그먼트의 고객만 필터링', async () => {
            const now = new Date();
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, last_visited_at: now, visit_count: 6, total_spent: 60000 },
                { id: 2, last_visited_at: new Date(now - 120 * 86400000), visit_count: 3, total_spent: 25000 },
            ]);

            const res = mockRes();
            await crmController.getSegmentCustomers(
                { params: { storeId: '1', segmentName: 'Champions' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.segment).toBe('Champions');
            expect(data.count).toBe(1);
            expect(data.customers[0].id).toBe(1);
        });
    });

    describe('sendSmartMarketingSms', () => {
        beforeEach(() => {
            prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '테스트매장', can_send_sms: true });
        });

        test('segmentName 없으면 400 에러', async () => {
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '1' }, body: {} },
                mockRes(),
                mockNext
            );
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
        });

        test('매장 미존재 시 404 에러', async () => {
            prisma.stores.findUnique.mockResolvedValue(null);
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '999' }, body: { segmentName: 'Champions' } },
                mockRes(),
                mockNext
            );
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
        });

        test('SMS 권한 없으면 403 에러', async () => {
            prisma.stores.findUnique.mockResolvedValue({ id: 1, can_send_sms: false });
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '1' }, body: { segmentName: 'Champions' } },
                mockRes(),
                mockNext
            );
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
        });

        test('발송 대상 없으면 sent: 0 반환', async () => {
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, visit_count: 1, total_spent: 5000, customer_phone: '01012345678' }
            ]);
            const res = mockRes();
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '1' }, body: { segmentName: 'Champions' } },
                res,
                mockNext
            );
            expect(res.success).toHaveBeenCalledWith({ sent: 0 }, expect.any(String));
        });

        test('AI 실패 시 기본 메시지 사용', async () => {
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, last_visited_at: new Date(), visit_count: 6, total_spent: 60000, customer_phone: '01012345678' },
            ]);
            aiService.translateText.mockRejectedValue(new Error('AI error'));

            const res = mockRes();
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '1' }, body: { segmentName: 'Champions' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.sent).toBe(1);
            expect(data.message).toContain('테스트매장');
        });

        test('커스텀 메시지 사용', async () => {
            prisma.store_customers.findMany.mockResolvedValue([
                { id: 1, last_visited_at: new Date(), visit_count: 6, total_spent: 60000, customer_phone: '01012345678' },
            ]);
            aiService.translateText.mockResolvedValue(null); // AI 개선 실패

            const res = mockRes();
            await crmController.sendSmartMarketingSms(
                { params: { storeId: '1' }, body: { segmentName: 'Champions', customMessage: '커스텀 메시지' } },
                res,
                mockNext
            );
            const data = res.success.mock.calls[0][0];
            expect(data.message).toBe('커스텀 메시지');
        });
    });
});

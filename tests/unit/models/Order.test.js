/**
 * Order 모델 단위 테스트
 *
 * 회귀 방지 핵심: tables include에 존재하지 않는 필드(name)를 select하면
 * Prisma가 에러를 던지고, 외곽 catch가 조용히 []를 반환해
 * "주문이 있는데 화면엔 0건"이 되는 버그가 있었다.
 */
jest.mock('../../../config/prisma', () => ({
    orders: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    order_items: { findMany: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const Order = require('../../../repositories/Order');

const makeOrder = (over = {}) => ({
    id: 1,
    store_id: 3,
    order_number: 'TEST001',
    status: 'pending',
    total_amount: 10000,
    created_at: new Date('2026-07-05T00:30:00Z'),
    order_items: [{ id: 10, item_name: '떡볶이', quantity: 2, price: 5000 }],
    payments: [],
    tables: { table_number: '5' },
    ...over,
});

describe('Order.findByStoreId', () => {
    beforeEach(() => jest.clearAllMocks());

    test('주문 목록을 items/table_name/latest_payment 매핑과 함께 반환한다', async () => {
        prisma.orders.findMany.mockResolvedValue([makeOrder()]);

        const result = await Order.findByStoreId(3);

        expect(result).toHaveLength(1);
        expect(result[0].items).toHaveLength(1);
        expect(result[0].table_name).toBe('5');
        expect(result[0].latest_payment).toBeNull();
    });

    test('tables select에 table_number만 요청한다 (name 필드 회귀 방지)', async () => {
        prisma.orders.findMany.mockResolvedValue([]);

        await Order.findByStoreId(3);

        const args = prisma.orders.findMany.mock.calls[0][0];
        expect(args.include.tables.select).toEqual({ table_number: true });
        // 존재하지 않는 name 필드가 다시 추가되면 이 단언이 실패한다
        expect(args.include.tables.select).not.toHaveProperty('name');
    });

    test('payments include 실패 시 payments 없이 재시도한다', async () => {
        prisma.orders.findMany
            .mockRejectedValueOnce(new Error('payments relation error'))
            .mockResolvedValueOnce([makeOrder({ payments: undefined })]);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await Order.findByStoreId(3);
        warnSpy.mockRestore();

        expect(prisma.orders.findMany).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(1);
        // 재시도 쿼리에는 payments include가 없어야 함
        const retryArgs = prisma.orders.findMany.mock.calls[1][0];
        expect(retryArgs.include).not.toHaveProperty('payments');
    });

    test('완전 실패 시 []를 반환하되 에러를 로깅한다 (무음 실패 방지)', async () => {
        prisma.orders.findMany.mockRejectedValue(new Error('DB down'));

        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await Order.findByStoreId(3);

        expect(result).toEqual([]);
        expect(errSpy).toHaveBeenCalled(); // 로깅 없이 삼키면 실패

        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    test('숫자가 아닌 storeId는 즉시 []', async () => {
        const result = await Order.findByStoreId('abc');
        expect(result).toEqual([]);
        expect(prisma.orders.findMany).not.toHaveBeenCalled();
    });

    test('상태 필터: 콤마 구분 다중 상태를 in 조건으로 변환', async () => {
        prisma.orders.findMany.mockResolvedValue([]);

        await Order.findByStoreId(3, 'pending,confirmed');

        const where = prisma.orders.findMany.mock.calls[0][0].where;
        expect(where.status).toEqual({ in: ['pending', 'confirmed'] });
    });

    test('날짜 필터: YYYY-MM-DD를 KST 하루 범위(UTC-9h 시작)로 변환', async () => {
        prisma.orders.findMany.mockResolvedValue([]);

        await Order.findByStoreId(3, null, '2026-07-05');

        const { created_at } = prisma.orders.findMany.mock.calls[0][0].where;
        // KST 2026-07-05 00:00 == UTC 2026-07-04 15:00
        expect(created_at.gte.toISOString()).toBe('2026-07-04T15:00:00.000Z');
        expect(created_at.lte.toISOString()).toBe('2026-07-05T14:59:59.999Z');
    });
});

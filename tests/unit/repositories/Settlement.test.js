jest.mock('../../../config/prisma', () => ({
  settlements: {
    create: jest.fn(),
    count: jest.fn(),
  },
  stores: { findUnique: jest.fn() },
  ledger: { groupBy: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const Settlement = require('../../../repositories/Settlement');

describe('Settlement repository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('집계된 매출에서 수수료를 차감해 정산을 생성한다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ commission_rate: 0.03, vat_rate: 0.1 });
    prisma.ledger.groupBy.mockResolvedValue([
      { type: 'INCOME', method: 'CARD', _sum: { amount: 10000 } },
      { type: 'INCOME', method: 'CASH', _sum: { amount: 5000 } },
      { type: 'REFUND', method: 'CARD', _sum: { amount: 2000 } },
    ]);
    prisma.settlements.create.mockResolvedValue({
      id: 1,
      store_id: 3,
      total_sales: 15000,
      total_refunds: 2000,
    });

    const result = await Settlement.create({
      store_id: 3,
      period_start: '2026-07-01T00:00:00.000Z',
      period_end: '2026-07-31T00:00:00.000Z',
    });

    // 순매출 13000, 수수료 390, 수수료 부가세 39, 총수수료 429, 점주수취 12571
    expect(prisma.settlements.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_sales: 15000,
          total_refunds: 2000,
          commission_ex_vat: 390,
          commission_vat: 39,
          commission_amount: 429,
          net_amount: 12571,
        }),
      })
    );
    expect(result.breakdown).toEqual({ CARD: 10000, CASH: 5000 });
    expect(result._calc).toMatchObject({ netSales: 13000, netAmount: 12571, commissionRate: 0.03 });
  });

  test('매장 설정이 없으면 기본 수수료율로 계산한다', async () => {
    prisma.stores.findUnique.mockResolvedValue(null);
    prisma.ledger.groupBy.mockResolvedValue([]);
    prisma.settlements.create.mockResolvedValue({ id: 2 });

    const result = await Settlement.create({
      store_id: 3,
      period_start: '2026-07-01T00:00:00.000Z',
      period_end: '2026-07-31T00:00:00.000Z',
    });

    expect(prisma.settlements.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commission_rate_snapshot: 0.03,
          vat_rate_snapshot: 0.1,
          period_end: expect.any(Date),
        }),
      })
    );
    expect(result._calc.netAmount).toBe(0);
  });
});

jest.mock('../../../config/prisma', () => ({
  settlements: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  stores: { findUnique: jest.fn() },
  ledger: { groupBy: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const Settlement = require('../../../repositories/Settlement');

describe('Settlement repository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the existing settlement for an identical period', async () => {
    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-07-31T00:00:00.000Z');
    periodEnd.setHours(23, 59, 59, 999);
    const existing = { id: 1, store_id: 3, period_start: periodStart, period_end: periodEnd };
    prisma.settlements.findFirst.mockResolvedValue(existing);

    const result = await Settlement.create({
      store_id: 3,
      period_start: periodStart,
      period_end: '2026-07-31T00:00:00.000Z',
    });

    expect(result).toBe(existing);
    expect(prisma.ledger.groupBy).not.toHaveBeenCalled();
  });

  test('rejects a period that overlaps an existing settlement', async () => {
    prisma.settlements.findFirst.mockResolvedValue({
      id: 1,
      period_start: new Date('2026-07-01T00:00:00.000Z'),
      period_end: new Date('2026-07-15T23:59:59.999Z'),
    });

    await expect(
      Settlement.create({
        store_id: 3,
        period_start: '2026-07-10T00:00:00.000Z',
        period_end: '2026-07-31T00:00:00.000Z',
      })
    ).rejects.toThrow(/겹칩니다/);
  });

  test('getSummary는 상태별 건수·수취액을 집계한다', async () => {
    prisma.settlements.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 }, _sum: { net_amount: 30000 } },
      { status: 'COMPLETED', _count: { _all: 1 }, _sum: { net_amount: 15000 } },
      { status: 'PAID', _count: { _all: 1 }, _sum: { net_amount: 10000 } },
    ]);
    const latest = { id: 7, status: 'PENDING', period_end: new Date('2026-07-31') };
    prisma.settlements.findFirst.mockResolvedValue(latest);

    const summary = await Settlement.getSummary(3);

    expect(prisma.settlements.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { store_id: 3 },
      _count: { _all: true },
      _sum: { net_amount: true },
    });
    expect(summary.statusCounts).toEqual({ PENDING: 2, COMPLETED: 1, PAID: 1, CANCELLED: 0 });
    expect(summary.totalCount).toBe(4);
    expect(summary.totalNet).toBe(55000);
    expect(summary.pendingNet).toBe(30000);
    expect(summary.latest).toBe(latest);
  });

  test('getSummary는 정산이 없으면 0 집계와 최신 내역 null을 반환한다', async () => {
    prisma.settlements.groupBy.mockResolvedValue([]);
    prisma.settlements.findFirst.mockResolvedValue(null);

    const summary = await Settlement.getSummary(3);

    expect(summary.statusCounts).toEqual({ PENDING: 0, COMPLETED: 0, PAID: 0, CANCELLED: 0 });
    expect(summary.totalCount).toBe(0);
    expect(summary.totalNet).toBe(0);
    expect(summary.pendingNet).toBe(0);
    expect(summary.latest).toBeNull();
  });
});

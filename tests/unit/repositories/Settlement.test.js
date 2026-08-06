jest.mock('../../../config/prisma', () => ({
  settlements: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
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
});

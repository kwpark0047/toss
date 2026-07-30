jest.mock('../../../config/prisma', () => ({
  ledger: { upsert: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const ledgerService = require('../../../services/LedgerService');

describe('LedgerService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uses a stable event key for idempotent payment income', async () => {
    prisma.ledger.upsert.mockResolvedValue({ id: 1 });

    await ledgerService.recordIncome({
      storeId: 1,
      orderId: 2,
      paymentId: 3,
      amount: 1000,
      method: 'CARD',
      description: 'sale',
    });

    expect(prisma.ledger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { event_key: 'payment:3:income' },
        create: expect.objectContaining({ event_key: 'payment:3:income' }),
        update: {},
      })
    );
  });

  test('accepts a refund event key so separate partial refunds remain distinct', async () => {
    prisma.ledger.upsert.mockResolvedValue({ id: 2 });

    await ledgerService.recordRefund({
      storeId: 1,
      orderId: 2,
      paymentId: 3,
      amount: -500,
      method: 'CARD',
      description: 'partial refund',
      eventKey: 'refund:9',
    });

    expect(prisma.ledger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { event_key: 'refund:9' } })
    );
  });
});

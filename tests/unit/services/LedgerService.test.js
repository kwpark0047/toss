jest.mock('../../../config/prisma', () => ({
  ledger: { create: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const ledgerService = require('../../../services/LedgerService');

describe('LedgerService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('결제 수익을 장부에 기록한다', async () => {
    prisma.ledger.create.mockResolvedValue({ id: 1 });

    const result = await ledgerService.recordIncome({
      storeId: 1,
      orderId: 2,
      paymentId: 3,
      amount: 1000,
      method: 'CARD',
      description: 'sale',
    });

    expect(prisma.ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          store_id: 1,
          order_id: 2,
          payment_id: 3,
          type: 'INCOME',
          category: 'SALE',
          amount: 1000,
          method: 'CARD',
        }),
      })
    );
    expect(result).toEqual({ id: 1 });
  });

  test('환불을 장부에 기록한다', async () => {
    prisma.ledger.create.mockResolvedValue({ id: 2 });

    await ledgerService.recordRefund({
      storeId: 1,
      orderId: 2,
      paymentId: 3,
      amount: -500,
      method: 'CARD',
      description: 'partial refund',
    });

    expect(prisma.ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REFUND',
          category: 'CANCEL',
          amount: -500,
        }),
      })
    );
  });
});

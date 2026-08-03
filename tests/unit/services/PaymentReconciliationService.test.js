jest.mock('../../../config/prisma', () => ({
  payments: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  orders: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((callback) =>
    callback({
      payments: { update: jest.fn() },
      orders: { updateMany: jest.fn() },
    })
  ),
}));

const paymentReconciliationService = require('../../../services/PaymentReconciliationService');
const prisma = require('../../../config/prisma');

describe('PaymentReconciliationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reconcileStalePayments', () => {
    test('30분이 지난 PENDING 결제 내역을 만료 처리한다', async () => {
      const staleItems = [{ id: 101, payment_status: 'PENDING', order_id: 501 }];
      prisma.payments.findMany.mockResolvedValue(staleItems);

      const count = await paymentReconciliationService.reconcileStalePayments();
      expect(prisma.payments.findMany).toHaveBeenCalled();
      expect(count).toBe(1);
    });

    test('대사할 stale 결제 내역이 없으면 0을 반환한다', async () => {
      prisma.payments.findMany.mockResolvedValue([]);

      const count = await paymentReconciliationService.reconcileStalePayments();
      expect(count).toBe(0);
    });
  });
});

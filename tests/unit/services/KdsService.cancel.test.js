jest.mock('../../../config/prisma', () => ({
  orders: { findUnique: jest.fn() },
  payments: { findMany: jest.fn() },
  notifications: { create: jest.fn() },
  print_jobs: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../services/AlimtalkService', () => ({ sendFoodReady: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../utils/phoneEncryption', () => ({ decryptPhone: jest.fn() }));
jest.mock('../../../services/OrderEventService', () => ({ record: jest.fn() }));

const mockOrderService = {
  _emitOrderUpdate: jest.fn(),
  _processInventory: jest.fn(),
  _restoreInventory: jest.fn().mockResolvedValue(),
  _revertPointsOnCancel: jest.fn().mockResolvedValue(),
  _sendOrderAlimtalk: jest.fn().mockResolvedValue(),
};
jest.mock('../../../services/OrderService', () => jest.fn(() => mockOrderService));
const mockProcessCancellation = jest.fn();
jest.mock('../../../services/PaymentService', () =>
  jest.fn(() => ({ processCancellation: mockProcessCancellation }))
);

const prisma = require('../../../config/prisma');
const kdsService = require('../../../services/KdsService');

const baseOrder = {
  id: 7,
  store_id: 3,
  order_number: 'A-007',
  status: 'preparing',
  order_items: [],
  tables: { table_number: '1번' },
  stores: { name: '테스트' },
};

function mockTransition(order) {
  prisma.orders.findUnique.mockResolvedValue(order);
  prisma.$transaction.mockImplementation((fn) =>
    fn({
      orders: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ ...order, order_items: [] }),
      },
      print_jobs: { create: jest.fn() },
    })
  );
}

describe('KdsService 상태 전파와 주방 취소', () => {
  const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
  beforeEach(() => jest.clearAllMocks());

  it('주방 상태 변경을 관리자·손님 화면용 order-updated로도 전파한다', async () => {
    mockTransition(baseOrder);
    await kdsService.updateKdsOrderStatus(3, 7, 'ready', null, io);
    expect(mockOrderService._emitOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      'ready'
    );
  });

  it('온라인 결제된 주문을 주방에서 취소하면 자동 환불하고 재고를 복구한다', async () => {
    mockTransition(baseOrder);
    prisma.payments.findMany.mockResolvedValue([{ id: 1, method: 'CARD', payment_key: 'pk_1' }]);
    await kdsService.updateKdsOrderStatus(3, 7, 'cancelled', null, io);
    expect(mockOrderService._restoreInventory).toHaveBeenCalledWith(7);
    expect(mockProcessCancellation).toHaveBeenCalledWith(7, '주방에서 주문 취소');
    expect(prisma.notifications.create).not.toHaveBeenCalled();
  });

  it('현장 결제 주문은 자동 환불하지 않고 환불 필요 알림을 남긴다', async () => {
    mockTransition(baseOrder);
    prisma.payments.findMany.mockResolvedValue([{ id: 2, method: 'CASH', payment_key: null }]);
    prisma.notifications.create.mockResolvedValue({ id: 9, created_at: new Date() });
    await kdsService.updateKdsOrderStatus(3, 7, 'cancelled', null, io);
    expect(mockProcessCancellation).not.toHaveBeenCalled();
    expect(prisma.notifications.create.mock.calls[0][0].data.type).toBe('REFUND_REQUIRED');
  });

  it('자동 환불이 실패하면 환불 필요 알림을 남긴다', async () => {
    mockTransition(baseOrder);
    prisma.payments.findMany.mockResolvedValue([{ id: 1, method: 'CARD', payment_key: 'pk_1' }]);
    mockProcessCancellation.mockRejectedValueOnce(new Error('토스 오류'));
    prisma.notifications.create.mockResolvedValue({ id: 10, created_at: new Date() });
    await kdsService.updateKdsOrderStatus(3, 7, 'cancelled', null, io);
    expect(prisma.notifications.create.mock.calls[0][0].data.message).toContain('토스 오류');
  });

  it('결제 전 접수 단계 취소는 재고 복구·환불을 하지 않는다', async () => {
    mockTransition({ ...baseOrder, status: 'pending' });
    prisma.payments.findMany.mockResolvedValue([]);
    await kdsService.updateKdsOrderStatus(3, 7, 'cancelled', null, io);
    expect(mockOrderService._restoreInventory).not.toHaveBeenCalled();
    expect(mockProcessCancellation).not.toHaveBeenCalled();
  });
});

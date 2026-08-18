jest.mock('../../../config/prisma', () => ({
  order_events: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));

const prisma = require('../../../config/prisma');
const orderEventService = require('../../../services/OrderEventService');

describe('OrderEventService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('상태 변경 이벤트를 기록한다', async () => {
    prisma.order_events.create.mockResolvedValue({ id: 1 });

    await orderEventService.record({
      orderId: 10,
      storeId: 3,
      eventType: 'STATUS_CHANGED',
      fromStatus: 'pending',
      toStatus: 'preparing',
      actorUserId: 7,
      actorRole: 'kitchen',
    });

    expect(prisma.order_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order_id: 10, store_id: 3, to_status: 'preparing' }),
      })
    );
  });

  it('주문별 이벤트 목록에 페이지네이션을 적용한다', async () => {
    prisma.order_events.count.mockResolvedValue(51);
    prisma.order_events.findMany.mockResolvedValue([]);

    const result = await orderEventService.list({ orderId: 10, page: 2, limit: 50 });

    expect(prisma.order_events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { order_id: 10 },
        skip: 50,
        take: 50,
      })
    );
    expect(result.totalPages).toBe(2);
  });
});

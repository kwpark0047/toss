jest.mock('../../../config/prisma', () => ({
  orders: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  staff: { findUnique: jest.fn() },
  print_jobs: { create: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../services/AlimtalkService', () => ({ sendFoodReady: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../utils/phoneEncryption', () => ({ decryptPhone: jest.fn() }));

const prisma = require('../../../config/prisma');
const kdsService = require('../../../services/KdsService');

describe('KdsService security and transitions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('사업자가 확인한 주문도 주방 대기 목록에 포함한다', async () => {
    prisma.orders.findMany.mockResolvedValue([]);
    await kdsService.getActiveKdsOrders(3);
    expect(prisma.orders.findMany.mock.calls[0][0].where.status.in).toContain('confirmed');
  });
  it('확인한 주문은 조리 시작이 가능하다', () => {
    expect(() =>
      require('../../../utils/orderStatus').assertKdsOrderStatusTransition('confirmed', 'preparing')
    ).not.toThrow();
  });
  it('같은 조리 상태 재시도는 인쇄 작업을 다시 만들지 않는다', async () => {
    prisma.orders.findUnique.mockResolvedValue({
      id: 1,
      store_id: 3,
      status: 'preparing',
      order_items: [],
    });
    await kdsService.updateKdsOrderStatus(3, 1, 'preparing');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('주방 조회는 고객 연락처·FCM·외부 식별자·주소를 노출하지 않는다', async () => {
    prisma.orders.findMany.mockResolvedValue([
      {
        id: 1,
        store_id: 3,
        customer_phone: 'private-phone',
        customer_fcm_token: 'private-push',
        toss_user_key: 'private-toss',
        delivery_address: 'private-address',
        order_items: [],
      },
    ]);
    const result = await kdsService.getActiveKdsOrders(3);
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(result[0].has_customer_contact).toBe(true);
  });

  it('잘못된 매장 ID를 거부한다', async () => {
    await expect(kdsService.getActiveKdsOrders('12abc')).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.orders.findMany).not.toHaveBeenCalled();
  });

  it('완료된 주문을 다시 조리중으로 되돌릴 수 없다', async () => {
    prisma.orders.findUnique.mockResolvedValue({ id: 1, store_id: 3, status: 'completed' });

    await expect(kdsService.updateKdsOrderStatus(3, 1, 'preparing')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('다른 매장 직원을 담당자로 지정할 수 없다', async () => {
    prisma.orders.findUnique.mockResolvedValue({ id: 1, store_id: 3, status: 'pending' });
    prisma.staff.findUnique.mockResolvedValue({ store_id: 99, is_active: 1 });

    await expect(kdsService.updateKdsOrderStatus(3, 1, 'preparing', 7)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

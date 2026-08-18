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

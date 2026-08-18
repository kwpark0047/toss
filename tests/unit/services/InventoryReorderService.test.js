jest.mock('../../../config/prisma', () => ({
  products: { findMany: jest.fn() },
  orders: { findMany: jest.fn() },
  inventory_reorder_candidates: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

const prisma = require('../../../config/prisma');
const service = require('../../../services/InventoryReorderService');

describe('InventoryReorderService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('판매량과 안전재고를 기준으로 발주 후보를 산출한다', async () => {
    prisma.products.findMany.mockResolvedValue([
      { id: 10, name: '원두', stock_quantity: 2, low_stock_threshold: 5 },
    ]);
    prisma.orders.findMany.mockResolvedValue([{ order_items: [{ product_id: 10, quantity: 30 }] }]);
    prisma.inventory_reorder_candidates.upsert.mockResolvedValue({ id: 1, status: 'pending' });

    const result = await service.generateCandidates(3, {
      lookbackDays: 30,
      leadTimeDays: 3,
      safetyDays: 2,
    });

    expect(result.candidates).toHaveLength(1);
    expect(prisma.inventory_reorder_candidates.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          store_id: 3,
          product_id: 10,
          suggested_quantity: 10,
          reorder_point: 5,
        }),
      })
    );
  });

  it('처리된 후보를 다시 결정할 수 없다', async () => {
    prisma.inventory_reorder_candidates.findFirst.mockResolvedValue({
      id: 1,
      store_id: 3,
      status: 'approved',
    });

    await expect(service.decide(1, 3, 'rejected', 7)).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.inventory_reorder_candidates.update).not.toHaveBeenCalled();
  });

  it('잘못된 상태 필터를 거부한다', async () => {
    await expect(service.list(3, 'unknown')).rejects.toMatchObject({ statusCode: 400 });
  });
});

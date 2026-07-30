const mockProducts = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
};
const mockStockHistory = {
  findMany: jest.fn(),
  create: jest.fn(),
};

jest.mock('../../../config/prisma', () => ({
  products: mockProducts,
  stock_history: mockStockHistory,
}));
jest.mock('../../../utils/dbCache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  flushByStore: jest.fn(),
}));

const Product = require('../../../repositories/Product');

describe('Product order stock operations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('조건부 updateMany로 재고를 예약하고 이력을 생성한다', async () => {
    mockProducts.findFirst.mockResolvedValue({
      id: 10,
      name: '상품',
      store_id: 1,
      stock_quantity: 5,
      low_stock_threshold: 2,
    });
    mockProducts.updateMany.mockResolvedValue({ count: 1 });
    mockProducts.findUnique.mockResolvedValue({
      id: 10,
      name: '상품',
      store_id: 1,
      stock_quantity: 2,
      low_stock_threshold: 2,
    });

    const result = await Product.reserveStock(10, 1, 3, 20);

    expect(mockProducts.updateMany).toHaveBeenCalledWith({
      where: {
        id: 10,
        store_id: 1,
        is_active: true,
        is_sold_out: false,
        stock_quantity: { gte: 3 },
      },
      data: { stock_quantity: { decrement: 3 } },
    });
    expect(mockStockHistory.create).toHaveBeenCalledWith({
      data: {
        product_id: 10,
        store_id: 1,
        change: -3,
        qty_after: 2,
        reason: 'ORDER',
        order_id: 20,
      },
    });
    expect(result.stock_quantity).toBe(2);
  });

  test('조건부 예약 경쟁에서 패배하면 이력을 만들지 않는다', async () => {
    mockProducts.findFirst.mockResolvedValue({
      id: 10,
      store_id: 1,
      stock_quantity: 2,
      low_stock_threshold: 1,
    });
    mockProducts.updateMany.mockResolvedValue({ count: 0 });

    await expect(Product.reserveStock(10, 1, 2, 20)).resolves.toBeNull();
    expect(mockStockHistory.create).not.toHaveBeenCalled();
  });

  test('ORDER 이력 수량을 집계해 취소 재고와 CANCEL 이력을 복구한다', async () => {
    mockStockHistory.findMany.mockResolvedValue([
      { product_id: 10, store_id: 1, change: -1 },
      { product_id: 10, store_id: 1, change: -2 },
    ]);
    mockProducts.findUnique.mockResolvedValue({ id: 10, store_id: 1, stock_quantity: 5 });

    await Product.restoreOrderStock(20);

    expect(mockProducts.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { stock_quantity: { increment: 3 }, is_sold_out: false },
    });
    expect(mockStockHistory.create).toHaveBeenCalledWith({
      data: {
        product_id: 10,
        store_id: 1,
        change: 3,
        qty_after: 5,
        reason: 'CANCEL',
        order_id: 20,
      },
    });
  });

  test('이미 CANCEL 이력으로 복구된 예약은 다시 복구하지 않는다', async () => {
    mockStockHistory.findMany.mockResolvedValue([
      { product_id: 10, store_id: 1, change: -3 },
      { product_id: 10, store_id: 1, change: 3 },
    ]);

    await expect(Product.restoreOrderStock(20)).resolves.toEqual([]);
    expect(mockProducts.update).not.toHaveBeenCalled();
    expect(mockStockHistory.create).not.toHaveBeenCalled();
  });
});

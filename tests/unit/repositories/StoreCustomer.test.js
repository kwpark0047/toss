jest.mock('../../../config/prisma', () => ({
  store_customers: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require('../../../config/prisma');
const StoreCustomer = require('../../../repositories/StoreCustomer');

describe('StoreCustomer query validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.store_customers.count.mockResolvedValue(0);
    prisma.store_customers.findMany.mockResolvedValue([]);
  });

  it('고객 목록의 limit을 100으로 제한한다', async () => {
    const result = await StoreCustomer.findByStoreId(3, { page: 2, limit: 500 });

    expect(prisma.store_customers.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 100,
        take: 100,
      })
    );
    expect(result).toEqual(expect.objectContaining({ page: 2, limit: 100 }));
  });

  it('허용되지 않은 정렬 기준과 방향을 거부한다', async () => {
    await expect(
      StoreCustomer.findByStoreId(3, { sortBy: 'id;drop', order: 'desc' })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      StoreCustomer.findByStoreId(3, { sortBy: 'created_at', order: 'sideways' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.store_customers.findMany).not.toHaveBeenCalled();
  });

  it('잘못된 매장 ID를 거부한다', async () => {
    await expect(StoreCustomer.findByStoreId('invalid')).rejects.toMatchObject({ statusCode: 400 });
  });
});

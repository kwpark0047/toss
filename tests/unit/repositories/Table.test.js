const mockTables = {
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};
const mockPrisma = {
  tables: mockTables,
  $transaction: jest.fn(),
};
jest.mock('../../../config/prisma', () => mockPrisma);

const Table = require('../../../repositories/Table');

describe('Table.updateLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTables.update.mockResolvedValue({});
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  test('요청 매장에 속하지 않은 테이블이 있으면 갱신 전에 거부한다', async () => {
    mockTables.findMany.mockResolvedValueOnce([{ id: 10, store_id: 5 }]);

    await expect(
      Table.updateLayout(42, [
        { id: 10, x: 1, y: 2 },
        { id: 11, x: 3, y: 4 },
      ])
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(mockTables.findMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] } },
      select: { id: true, store_id: true },
    });
    expect(mockTables.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('검증된 매장의 테이블만 트랜잭션에서 갱신한다', async () => {
    mockTables.findMany
      .mockResolvedValueOnce([
        { id: 10, store_id: 42 },
        { id: 11, store_id: 42 },
      ])
      .mockResolvedValue([
        { id: 10, store_id: 42 },
        { id: 11, store_id: 42 },
      ]);

    const result = await Table.updateLayout('42', [
      { id: '10', x: '1', y: '2' },
      { id: '11', x: '3', y: '4' },
    ]);

    expect(mockTables.update).toHaveBeenCalledTimes(2);
    expect(mockTables.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ x: 1, y: 2 }),
      })
    );
    expect(mockTables.findMany).toHaveBeenLastCalledWith({
      where: { store_id: 42, is_active: true },
    });
    expect(result).toEqual([
      { id: 10, store_id: 42 },
      { id: 11, store_id: 42 },
    ]);
  });
});

describe('Table.occupyActiveForStore', () => {
  test('매장 소유 활성 테이블만 조건부로 점유한다', async () => {
    mockTables.updateMany.mockResolvedValue({ count: 1 });

    await expect(Table.occupyActiveForStore(10, 42, { tables: mockTables })).resolves.toBe(true);
    expect(mockTables.updateMany).toHaveBeenCalledWith({
      where: { id: 10, store_id: 42, is_active: true },
      data: { status: 'occupied', updated_at: expect.any(Date) },
    });
  });
});

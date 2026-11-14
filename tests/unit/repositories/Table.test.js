const mockTransactionTables = {
  findMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};
const mockPrisma = {
  tables: {},
  $transaction: jest.fn((callback) => callback({ tables: mockTransactionTables })),
};
jest.mock('../../../config/prisma', () => mockPrisma);

const Table = require('../../../repositories/Table');

describe('Table.updateLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionTables.update.mockResolvedValue({});
  });

  test('요청 매장에 속하지 않은 테이블이 있으면 갱신 전에 거부한다', async () => {
    mockTransactionTables.findMany.mockResolvedValueOnce([{ id: 10 }]);

    await expect(
      Table.updateLayout(42, [
        { id: 10, x: 1, y: 2 },
        { id: 11, x: 3, y: 4 },
      ])
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_TABLE_STORE',
    });

    expect(mockTransactionTables.findMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] }, store_id: 42 },
      select: { id: true },
    });
    expect(mockTransactionTables.update).not.toHaveBeenCalled();
  });

  test('검증된 매장의 테이블만 트랜잭션에서 갱신한다', async () => {
    mockTransactionTables.findMany
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }])
      .mockResolvedValueOnce([
        { id: 10, store_id: 42 },
        { id: 11, store_id: 42 },
      ]);

    const result = await Table.updateLayout('42', [
      { id: '10', x: '1', y: '2' },
      { id: '11', x: '3', y: '4' },
    ]);

    expect(mockTransactionTables.update).toHaveBeenCalledTimes(2);
    expect(mockTransactionTables.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ x: 1, y: 2 }),
      })
    );
    expect(mockTransactionTables.findMany).toHaveBeenLastCalledWith({
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
    mockTransactionTables.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      Table.occupyActiveForStore(10, 42, { tables: mockTransactionTables })
    ).resolves.toBe(true);
    expect(mockTransactionTables.updateMany).toHaveBeenCalledWith({
      where: { id: 10, store_id: 42, is_active: true },
      data: { status: 'occupied', updated_at: expect.any(Date) },
    });
  });
});

describe('Table.findByStoreAndTable', () => {
  beforeEach(() => {
    mockPrisma.tables.findMany = jest.fn();
  });

  test('QR의 "1번"과 저장된 "1"을 같은 테이블로 찾는다', async () => {
    mockPrisma.tables.findMany.mockResolvedValueOnce([{ id: 5, table_number: '1' }]);
    const table = await Table.findByStoreAndTable(3, '1번');
    expect(table).toEqual({ id: 5, table_number: '1' });
    expect(mockPrisma.tables.findMany.mock.calls[0][0].where).toEqual({
      store_id: 3,
      table_number: { in: ['1번', '1', '1번'].filter((v, i, a) => a.indexOf(v) === i) },
    });
  });

  test('저장된 이름이 "1번"이면 "1"로도 찾고, 정확히 일치하는 이름을 우선한다', async () => {
    mockPrisma.tables.findMany.mockResolvedValueOnce([
      { id: 6, table_number: '1번' },
      { id: 7, table_number: '1' },
    ]);
    expect(await Table.findByStoreAndTable(3, '1')).toEqual({ id: 7, table_number: '1' });
  });

  test('없으면 null', async () => {
    mockPrisma.tables.findMany.mockResolvedValueOnce([]);
    expect(await Table.findByStoreAndTable(3, '룸9')).toBeNull();
  });
});

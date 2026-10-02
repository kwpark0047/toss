jest.mock('../../../config/prisma', () => ({
  store_customers: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  stores: {
    findMany: jest.fn(),
  },
}));
jest.mock('../../../utils/smsService', () => ({
  sendSms: jest.fn().mockResolvedValue({ ok: true }),
}));

const bulkSmsController = require('../../../controllers/bulkSmsController');
const prisma = require('../../../config/prisma');

describe('bulkSmsController.getFilteredCustomers', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.success = jest.fn().mockReturnValue(res);
    return res;
  };

  const superAdmin = { role: 'super_admin' };

  // utils/catchAsync 는 내부 Promise 를 반환하지 않으므로 (호출부 fire-and-forget)
  // 핸들러가 끝날 때까지 마이크로태스크를 비워줘야 단언이 유효하다.
  const invoke = async (req, res) => {
    const next = jest.fn();
    bulkSmsController.getFilteredCustomers(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));
    return next;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.store_customers.findMany.mockResolvedValue([]);
    prisma.store_customers.count.mockResolvedValue(0);
  });

  test('super_admin 이 아니면 403 이고 DB 를 조회하지 않는다', async () => {
    const res = mockRes();
    await invoke({ user: { role: 'user' }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.store_customers.findMany).not.toHaveBeenCalled();
    expect(prisma.store_customers.count).not.toHaveBeenCalled();
  });

  // 회귀 테스트: 이전 구현은 take 없이 전체 행을 JOIN 조회한 뒤 slice(0,100) 으로 버렸다.
  test('DB 레벨에서 100건으로 제한한다 (take 미사용 회귀 방지)', async () => {
    const res = mockRes();
    prisma.store_customers.count.mockResolvedValue(12345);

    await invoke({ user: superAdmin, query: { storeId: '7' } }, res);

    const args = prisma.store_customers.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.orderBy).toEqual({ created_at: 'desc' });
    expect(args.where).toEqual({ store_id: 7 });
  });

  // count 는 전체 건수여야 한다. take 로 잘린 배열 길이를 쓰면 표시값이 최대 100 으로 고정된다.
  test('count 응답은 전체 건수를 보고하고 hasMore 로 잘림 여부를 알린다', async () => {
    const res = mockRes();
    const row = { customer_phone: '010-0000-0000' };
    prisma.store_customers.findMany.mockResolvedValue([row]);
    prisma.store_customers.count.mockResolvedValue(12345);

    await invoke({ user: superAdmin, query: {} }, res);

    expect(res.success).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 12345,
        hasMore: true,
        customers: [row],
      })
    );
  });

  test('전체 건수가 100 이하이면 hasMore 가 false 다', async () => {
    const res = mockRes();
    prisma.store_customers.count.mockResolvedValue(42);

    await invoke({ user: superAdmin, query: {} }, res);

    expect(res.success).toHaveBeenCalledWith(
      expect.objectContaining({ count: 42, hasMore: false })
    );
  });

  test('region/businessType 필터가 stores 조건으로 전달된다', async () => {
    const res = mockRes();

    await invoke({ user: superAdmin, query: { region: '서울', businessType: 'cafe' } }, res);

    const expectedStores = { address: { startsWith: '서울' }, business_type: 'cafe' };
    expect(prisma.store_customers.findMany.mock.calls[0][0].where.stores).toEqual(expectedStores);
    expect(prisma.store_customers.count.mock.calls[0][0].where.stores).toEqual(expectedStores);
  });

  test('필터가 없으면 stores 조건을 넣지 않는다', async () => {
    const res = mockRes();

    await invoke({ user: superAdmin, query: {} }, res);

    expect(prisma.store_customers.findMany.mock.calls[0][0].where.stores).toBeUndefined();
  });

  // count 는 findMany 와 동일한 where 를 써야 총계가 어긋나지 않는다.
  test('findMany 와 count 가 동일한 where 를 공유한다', async () => {
    const res = mockRes();

    await invoke({ user: superAdmin, query: { storeId: '3', region: '부산' } }, res);

    expect(prisma.store_customers.findMany.mock.calls[0][0].where).toEqual(
      prisma.store_customers.count.mock.calls[0][0].where
    );
  });

  test('조회와 건수 계산을 각각 한 번만 호출한다', async () => {
    const res = mockRes();

    await invoke({ user: superAdmin, query: {} }, res);

    expect(prisma.store_customers.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.store_customers.count).toHaveBeenCalledTimes(1);
  });
});

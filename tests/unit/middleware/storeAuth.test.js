const prisma = require('../../../config/prisma');

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  $queryRawUnsafe: jest.fn(),
  staff: { findFirst: jest.fn() },
  products: { findUnique: jest.fn(), findMany: jest.fn() },
  tables: { findMany: jest.fn() },
}));
jest.mock('../../../utils/logger');

const {
  getStoreRole,
  checkStorePermission,
  checkStorePermissionForObject,
  checkStorePermissionForObjectBatch,
  checkUniformStoreMutation,
} = require('../../../middleware/storeAuth');

const mockRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

const resetMocks = () => {
  jest.resetAllMocks();
  prisma.$queryRawUnsafe.mockResolvedValue([
    { business_access_status: 'approved', trial_ends_at: null },
  ]);
};

describe('getStoreRole', () => {
  beforeEach(resetMocks);

  test('only considers active staff memberships', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });

    await expect(getStoreRole(7, 10)).resolves.toBe('manager');

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { store_id: 10, user_id: 7, is_active: 1 },
    });
  });

  test('returns owner when the user owns the store', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });

    await expect(getStoreRole(7, 10)).resolves.toBe('owner');
  });

  test('returns null without an active membership', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(getStoreRole(7, 10)).resolves.toBeNull();
  });
});

describe('checkStorePermission manager capabilities', () => {
  beforeEach(() => {
    resetMocks();
    prisma.$queryRawUnsafe.mockResolvedValue([
      { business_access_status: 'approved', trial_ends_at: null },
    ]);
  });

  test.each(['settings:read', 'settings:write', 'products:write', 'orders:update'])(
    '매니저는 %s 권한을 가진다',
    async (permission) => {
      prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
      prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
      const req = { user: { id: 7, role: 'manager' }, params: { storeId: '10' } };
      const next = jest.fn();

      await checkStorePermission(permission)(req, mockRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.storeRole).toBe('manager');
    }
  );

  test('매니저는 매장 삭제 권한을 갖지 않는다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
    const next = jest.fn();

    await checkStorePermission('store:delete')(
      { user: { id: 7, role: 'manager' }, params: { storeId: '10' } },
      mockRes(),
      next
    );

    expect(next).not.toHaveBeenCalled();
  });

  test('체험 만료 매장의 쓰기 요청은 모든 매장 구성원에게 차단된다', async () => {
    prisma.stores.findUnique
      .mockResolvedValueOnce({ user_id: 99 })
      .mockResolvedValueOnce({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);
    const res = mockRes();
    const next = jest.fn();

    await checkStorePermission('settings:write')(
      { method: 'PATCH', user: { id: 7, role: 'manager' }, params: { storeId: '10' } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('expired trial may still use subscription routes to recover paid access', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);
    const next = jest.fn();
    await checkStorePermission('store:update', 'store_id', { allowExpiredTrialWrite: true })(
      { method: 'POST', user: { id: 7, role: 'owner' }, params: { storeId: '10' } },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('billing exception does not allow suspended business accounts', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      { business_access_status: 'suspended', trial_ends_at: null },
    ]);
    const res = mockRes();
    const next = jest.fn();
    await checkStorePermission('store:update', 'store_id', { allowExpiredTrialWrite: true })(
      { method: 'POST', user: { id: 7, role: 'owner' }, params: { storeId: '10' } },
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test.each(['suspended', 'fraud_review'])(
    '중단/안전성 검토 매장은 GET도 모든 직원에게 차단된다 (%s)',
    async (business_access_status) => {
      prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
      prisma.staff.findFirst.mockResolvedValue({ role: 'manager' });
      prisma.$queryRawUnsafe.mockResolvedValue([{ business_access_status, trial_ends_at: null }]);
      const res = mockRes();
      const next = jest.fn();
      await checkStorePermission('orders:read')(
        { method: 'GET', user: { id: 7, role: 'manager' }, params: { storeId: '10' } },
        res,
        next
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code:
            business_access_status === 'suspended'
              ? 'BUSINESS_ACCOUNT_SUSPENDED'
              : 'BUSINESS_ACCOUNT_REVIEW',
        })
      );
      expect(next).not.toHaveBeenCalled();
    }
  );

  test('대상 매장 필드가 별도 이름이어도 체험 만료를 검사한다', async () => {
    prisma.stores.findUnique
      .mockResolvedValueOnce({ user_id: 7 })
      .mockResolvedValueOnce({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);
    const res = mockRes();
    const next = jest.fn();

    await checkStorePermission('items:manage', 'target_store_id')(
      {
        method: 'POST',
        user: { id: 7, role: 'owner' },
        params: {},
        query: {},
        body: { target_store_id: 10 },
      },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('checkStorePermissionForObject', () => {
  beforeEach(resetMocks);

  test('rejects unauthenticated requests', async () => {
    const res = mockRes();
    const next = jest.fn();
    const mw = checkStorePermissionForObject('products');

    await mw({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: '인증이 필요합니다' });
    expect(next).not.toHaveBeenCalled();
  });

  test('lets super_admin and capability holders through', async () => {
    const next = jest.fn();
    const mw = checkStorePermissionForObject('products');

    await mw({ user: { role: 'super_admin' }, params: { id: '1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    next.mockClear();
    await mw(
      {
        method: 'POST',
        user: { role: 'customer' },
        orderCapability: { orderId: 1 },
        params: { id: '1' },
      },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid ids with AppError', async () => {
    const next = jest.fn();
    const mw = checkStorePermissionForObject('products');

    await mw({ user: { id: 7, role: 'owner' }, params: { id: 'abc' } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('passes through when object is missing or global', async () => {
    const next = jest.fn();
    prisma.products.findUnique.mockResolvedValueOnce(null);
    prisma.products.findUnique.mockResolvedValueOnce({ id: 5, store_id: null });

    const mw = checkStorePermissionForObject('products');
    await mw({ user: { id: 7, role: 'owner' }, params: { id: '5' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));

    next.mockClear();
    await mw({ user: { id: 7, role: 'owner' }, params: { id: '5' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('sets storeId/storeRole and continues for an authorized member', async () => {
    const next = jest.fn();
    prisma.products.findUnique.mockResolvedValue({ id: 5, store_id: 3 });
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });

    const req = { user: { id: 7, role: 'owner' }, params: { id: '5' } };
    await checkStorePermissionForObject('products')(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.storeId).toBe(3);
    expect(req.storeRole).toBe('owner');
  });

  test('blocks object updates when the owning business trial has expired', async () => {
    const res = mockRes();
    const next = jest.fn();
    prisma.products.findUnique.mockResolvedValue({ id: 5, store_id: 3 });
    prisma.stores.findUnique
      .mockResolvedValueOnce({ user_id: 7 })
      .mockResolvedValueOnce({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);

    await checkStorePermissionForObject('products')(
      { method: 'PATCH', user: { id: 7, role: 'owner' }, params: { id: '5' } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('keeps object reads available after expiry while checking account restrictions', async () => {
    const next = jest.fn();
    prisma.products.findUnique.mockResolvedValue({ id: 5, store_id: 3 });
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);
    await checkStorePermissionForObject('products')(
      { method: 'GET', user: { id: 7, role: 'owner' }, params: { id: '5' } },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  test('rejects non-members with 403', async () => {
    const res = mockRes();
    const next = jest.fn();
    prisma.products.findUnique.mockResolvedValue({ id: 5, store_id: 3 });
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue(null);

    await checkStorePermissionForObject('products')(
      { user: { id: 7, role: 'staff' }, params: { id: '5' } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('checkStorePermissionForObjectBatch', () => {
  beforeEach(resetMocks);

  test('rejects unauthenticated requests', async () => {
    const res = mockRes();
    const next = jest.fn();

    await checkStorePermissionForObjectBatch('products')({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('lets super_admin through', async () => {
    const next = jest.fn();

    await checkStorePermissionForObjectBatch('products')(
      { user: { role: 'super_admin' }, params: { id: '1' } },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid ids and missing rows', async () => {
    const next = jest.fn();
    const mw = checkStorePermissionForObjectBatch('products');

    await mw({ user: { id: 7, role: 'owner' }, params: { id: '-1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));

    next.mockClear();
    prisma.products.findMany.mockResolvedValue([]);
    await mw({ user: { id: 7, role: 'owner' }, params: { id: '5' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  test('sets storeId/storeRole from the found row and continues', async () => {
    const next = jest.fn();
    prisma.products.findMany.mockResolvedValue([{ id: 5, store_id: 3 }]);
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });

    const req = { user: { id: 7, role: 'owner' }, params: { id: '5' } };
    await checkStorePermissionForObjectBatch('products')(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.storeId).toBe(3);
    expect(req.storeRole).toBe('owner');
  });

  test('blocks batch table changes when the owning business trial has expired', async () => {
    const res = mockRes();
    const next = jest.fn();
    prisma.products.findMany.mockResolvedValue([{ id: 5, store_id: 3 }]);
    prisma.stores.findUnique
      .mockResolvedValueOnce({ user_id: 7 })
      .mockResolvedValueOnce({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);

    await checkStorePermissionForObjectBatch('products')(
      { method: 'PATCH', user: { id: 7, role: 'owner' }, params: { id: '5' } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('checkUniformStoreMutation', () => {
  beforeEach(resetMocks);

  test('rejects unauthenticated requests', async () => {
    const res = mockRes();
    const next = jest.fn();

    await checkUniformStoreMutation('tables')({ body: { items: [{ id: 1 }] } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rejects when there are no valid target ids', async () => {
    const next = jest.fn();

    await checkUniformStoreMutation('tables')(
      { user: { id: 7, role: 'owner' }, body: { items: [] } },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('rejects targets spanning multiple stores', async () => {
    const res = mockRes();
    const next = jest.fn();
    prisma.tables.findMany.mockResolvedValue([
      { id: 1, store_id: 3 },
      { id: 2, store_id: 4 },
    ]);

    await checkUniformStoreMutation('tables')(
      { user: { id: 7, role: 'owner' }, body: { items: [{ id: 1 }, { id: 2 }] } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('lets super_admin through and records the store', async () => {
    const next = jest.fn();
    prisma.tables.findMany.mockResolvedValue([
      { id: 1, store_id: 3 },
      { id: 2, store_id: 3 },
    ]);

    const req = { user: { role: 'super_admin' }, body: { items: [{ id: 1 }, { id: 2 }] } };
    await checkUniformStoreMutation('tables')(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.storeId).toBe(3);
  });

  test('sets storeId/storeRole for an authorized member', async () => {
    const next = jest.fn();
    prisma.tables.findMany.mockResolvedValue([
      { id: 1, store_id: 3 },
      { id: 2, store_id: 3 },
    ]);
    prisma.stores.findUnique.mockResolvedValue({ user_id: 7 });

    const req = { user: { id: 7, role: 'owner' }, body: { items: [{ id: 1 }, { id: 2 }] } };
    await checkUniformStoreMutation('tables')(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.storeId).toBe(3);
    expect(req.storeRole).toBe('owner');
  });

  test('blocks uniform table mutations when the owning business trial has expired', async () => {
    const res = mockRes();
    const next = jest.fn();
    prisma.tables.findMany.mockResolvedValue([{ id: 1, store_id: 3 }]);
    prisma.stores.findUnique
      .mockResolvedValueOnce({ user_id: 7 })
      .mockResolvedValueOnce({ user_id: 7 });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);

    await checkUniformStoreMutation('tables')(
      { method: 'PATCH', user: { id: 7, role: 'owner' }, body: { items: [{ id: 1 }] } },
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRIAL_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});

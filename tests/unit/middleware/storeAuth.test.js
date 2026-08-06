const prisma = require('../../../config/prisma');

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
  products: { findUnique: jest.fn(), findMany: jest.fn() },
  tables: { findMany: jest.fn() },
}));
jest.mock('../../../utils/logger');

const {
  getStoreRole,
  checkStorePermissionForObject,
  checkStorePermissionForObjectBatch,
  checkUniformStoreMutation,
} = require('../../../middleware/storeAuth');

const mockRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

describe('getStoreRole', () => {
  beforeEach(() => jest.resetAllMocks());

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

describe('checkStorePermissionForObject', () => {
  beforeEach(() => jest.resetAllMocks());

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
      { user: { role: 'customer' }, orderCapability: { orderId: 1 }, params: { id: '1' } },
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
  beforeEach(() => jest.resetAllMocks());

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
});

describe('checkUniformStoreMutation', () => {
  beforeEach(() => jest.resetAllMocks());

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
});

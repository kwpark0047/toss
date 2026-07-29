const { createOrderCapability } = require('../../../utils/orderCapability');
const orderCapability = require('../../../middleware/orderCapability');

describe('orderCapability middleware', () => {
  const originalSecret = process.env.ORDER_CAPABILITY_SECRET;

  beforeEach(() => {
    process.env.ORDER_CAPABILITY_SECRET = 'test-order-capability-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ORDER_CAPABILITY_SECRET;
    else process.env.ORDER_CAPABILITY_SECRET = originalSecret;
  });

  function response() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  test('allows a capability bound to the requested order', () => {
    const token = createOrderCapability({ id: 10, store_id: 3 });
    const req = { get: jest.fn().mockReturnValue(token), body: { order_id: 10 }, params: {} };
    const res = response();
    const next = jest.fn();

    orderCapability(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.orderCapability).toEqual(expect.objectContaining({ orderId: 10, storeId: 3 }));
  });

  test('rejects a token for another order', () => {
    const token = createOrderCapability({ id: 10, store_id: 3 });
    const req = { get: jest.fn().mockReturnValue(token), body: { order_id: 11 }, params: {} };
    const res = response();

    orderCapability(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});

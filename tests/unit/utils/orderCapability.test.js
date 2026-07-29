const jwt = require('jsonwebtoken');

const { createOrderCapability, verifyOrderCapability } = require('../../../utils/orderCapability');

describe('orderCapability', () => {
  const originalSecret = process.env.ORDER_CAPABILITY_SECRET;

  beforeEach(() => {
    process.env.ORDER_CAPABILITY_SECRET = 'test-order-capability-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.ORDER_CAPABILITY_SECRET;
    else process.env.ORDER_CAPABILITY_SECRET = originalSecret;
  });

  test('creates a short-lived token bound to order and store', () => {
    const token = createOrderCapability({ id: 10, store_id: 3 });
    const payload = verifyOrderCapability(token);

    expect(payload).toEqual(
      expect.objectContaining({
        type: 'order_capability',
        orderId: 10,
        storeId: 3,
      })
    );
    expect(payload.exp - payload.iat).toBe(2 * 60 * 60);
  });

  test('rejects invalid token types and signatures', () => {
    const wrongType = jwt.sign(
      { type: 'access', orderId: 10 },
      process.env.ORDER_CAPABILITY_SECRET
    );
    expect(verifyOrderCapability(wrongType)).toBeNull();
    expect(verifyOrderCapability('invalid')).toBeNull();
  });
});

const jwt = require('jsonwebtoken');
const capability = require('../../../utils/orderCapability');
test('history proof contains only verified store and owned order scope, never customer identifiers', () => {
  const token = capability.createCustomerHistoryCapability({
    store_id: 3,
    order_ids: [10, 11],
    phone: 'victim',
    toss_user_key: 'forged',
  });
  const payload = jwt.decode(token);
  expect(payload).toMatchObject({ version: 2, storeId: 3, orderIds: [10, 11] });
  expect(payload.phone).toBeUndefined();
  expect(payload.toss_user_key).toBeUndefined();
});
test('legacy unbounded phone token is not private history authorization', () => {
  const legacy = jwt.sign(
    { type: 'customer_history_capability', phone: '01011112222' },
    process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET
  );
  expect(capability.verifyCustomerHistoryCapability(legacy)).toBeNull();
});
test('phone alone cannot mint private history proof', () => {
  expect(capability.createCustomerHistoryCapability({ phone: '01011112222' })).toBeNull();
});
test('cross-origin client can send the bounded history proof through CORS preflight', () => {
  expect(require('../../../config/corsHeaders').CORS_HEADERS).toContain(
    'X-Customer-History-Capability'
  );
});

const assert = require('node:assert/strict');
const { cleanOrder, cleanCashRequest, allowRead } = require('./mobile-push-lab-policy.cjs');
const fixture = { storeId: 1, productId: 1, productName: 'QA 테스트 메뉴', price: 10000 };
const valid = {
  store_id: 1,
  order_type: 'dine_in',
  payment_method: 'cash',
  total_amount: 10000,
  items: [
    {
      product_id: 1,
      product_name: 'QA 테스트 메뉴',
      price: 10000,
      quantity: 1,
      subtotal: 10000,
      options: {},
    },
  ],
};
assert.equal(cleanOrder(valid, fixture).total_amount, 10000);
assert.equal(
  require('../src/validation/schemas').createOrderSchema.safeParse(cleanOrder(valid, fixture))
    .success,
  true,
  'lab payload must pass the actual order API schema'
);
for (const bad of [
  { payment_method: 'card' },
  { store_id: 2 },
  { customer_phone: 'TEST_REJECTED' },
  { customer_name: 'TEST_REJECTED' },
  { order_type: 'delivery' },
  { notes: 'TEST_REJECTED' },
  { total_amount: 0 },
  { is_split_payment: true },
])
  assert.throws(() => cleanOrder({ ...valid, ...bad }, fixture));
assert.throws(() =>
  cleanOrder({ ...valid, items: [{ ...valid.items[0], product_id: 2 }] }, fixture)
);
assert.throws(() =>
  cleanOrder(
    { ...valid, items: [{ ...valid.items[0], options: { text: 'TEST_REJECTED' } }] },
    fixture
  )
);
assert.equal(allowRead('/api/stores/1', fixture), true);
for (const denied of [
  '/api/stores/2',
  '/api/auth/login',
  '/api/payments/confirm',
  '/api/orders/store/1',
  '/api/_devops',
  '/api/users',
])
  assert.equal(allowRead(denied, fixture), false);
console.log('PASS: isolated cash-order validation and public API allowlist');
const cash = {
  order_id: 11,
  store_id: 1,
  payment_method: 'cash',
  total_amount: 10000,
  point_amount: 0,
};
assert.equal(cleanCashRequest(cash, fixture, [{ id: 11, amount: 10000 }]).payment_method, 'cash');
for (const bad of [
  { payment_method: 'card' },
  { order_id: 12 },
  { store_id: 2 },
  { total_amount: 1 },
  { point_amount: 10000 },
  { phone: 'REJECT' },
  { paymentKey: 'REJECT' },
])
  assert.throws(() => cleanCashRequest({ ...cash, ...bad }, fixture, [{ id: 11, amount: 10000 }]));

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOrderSchema } = require('../../src/validation/schemas/order');
const request = {
  store_id: '1',
  table_number: '1',
  payment_method: 'toss',
  total_amount: 7500,
  items: [
    {
      product_id: 2,
      product_name: 'fixture',
      price: 7500,
      quantity: 1,
      subtotal: 7500,
      options: [],
    },
  ],
};
test('QR request retains service contract and option identity', () => {
  const parsed = createOrderSchema.parse(request);
  assert.equal(parsed.store_id, 1);
  assert.equal(parsed.table_number, '1');
  assert.equal(parsed.payment_method, 'toss');
  assert.equal(parsed.items[0].product_id, 2);
  const option = {
    groupId: 1,
    groupName: 'size',
    choiceId: 2,
    choiceName: 'large',
    priceAdjustment: 500,
  };
  const withOptions = createOrderSchema.parse({
    ...request,
    items: [{ ...request.items[0], options: [option] }],
  });
  assert.deepEqual(withOptions.items[0].options[0], option);
});
test('camelCase clients normalize to service fields', () => {
  const parsed = createOrderSchema.parse({
    storeId: 1,
    paymentMethod: 'toss_pay',
    items: [
      { productId: 2, productName: 'fixture', quantity: 1, unitPrice: 7500, totalPrice: 7500 },
    ],
  });
  assert.equal(parsed.store_id, 1);
  assert.equal(parsed.items[0].product_id, 2);
  assert.equal(parsed.total_amount, 7500);
});
test('invalid quantities and ambiguous tenant aliases are rejected', () => {
  assert.equal(
    createOrderSchema.safeParse({ ...request, items: [{ ...request.items[0], quantity: 0 }] })
      .success,
    false
  );
  assert.equal(createOrderSchema.safeParse({ ...request, storeId: 2 }).success, false);
});

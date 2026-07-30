const schemas = require('../../../utils/validationSchemas');

describe('order create validation', () => {
  const validOrder = {
    store_id: 1,
    total_amount: 1000,
    payment_method: 'card',
    items: [{ product_id: 10, product_name: '상품', quantity: 1, price: 1000 }],
  };

  test('양수 user_coupon_id를 허용한다', () => {
    expect(schemas.order.create.validate({ ...validOrder, user_coupon_id: 3 }).error).toBeUndefined();
  });

  test.each([
    ['store_id', { store_id: 0 }],
    ['user_coupon_id', { user_coupon_id: -1 }],
    ['table_id', { table_id: '0' }],
    ['product_id', { items: [{ ...validOrder.items[0], product_id: 0 }] }],
  ])('%s는 양수가 아니면 거부한다', (_field, override) => {
    expect(schemas.order.create.validate({ ...validOrder, ...override }).error).toBeDefined();
  });
});

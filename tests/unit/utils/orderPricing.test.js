jest.mock('../../../utils/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

const { priceOrderItem, assertClientTotal } = require('../../../utils/orderPricing');

const product = {
  id: 10,
  store_id: 1,
  name: '라떼',
  price: 4000,
  is_active: true,
  is_sold_out: false,
  options: JSON.stringify([
    {
      id: 'size',
      name: '사이즈',
      is_required: true,
      choices: [
        { id: 'regular', name: 'Regular', price_adjustment: 0 },
        { id: 'large', name: 'Large', price_adjustment: 700 },
      ],
    },
  ]),
};

describe('orderPricing', () => {
  test('uses server product and option prices for the snapshot', () => {
    const result = priceOrderItem(
      product,
      {
        product_id: 10,
        product_name: '위조 이름',
        price: 1,
        quantity: 2,
        options: [{ groupId: 'size', choiceId: 'large', priceAdjustment: 0 }],
      },
      1
    );

    expect(result).toEqual(
      expect.objectContaining({ product_name: '라떼', price: 4700, subtotal: 9400 })
    );
    expect(result.options[0].priceAdjustment).toBe(700);
  });

  test('rejects unknown or omitted required options', () => {
    expect(() => priceOrderItem(product, { product_id: 10, quantity: 1, options: [] }, 1)).toThrow(
      /필수 옵션/
    );
    expect(() =>
      priceOrderItem(
        product,
        {
          product_id: 10,
          quantity: 1,
          options: [{ groupId: 'size', choiceId: 'forged' }],
        },
        1
      )
    ).toThrow(/옵션이 올바르지/);
  });

  test('supports multiple authoritative choices up to max_choices', () => {
    const multiProduct = {
      ...product,
      options: JSON.stringify([
        {
          id: 'topping',
          name: '토핑',
          max_choices: 2,
          choices: [
            { id: 'shot', name: '샷', price_adjustment: 500 },
            { id: 'cream', name: '크림', price_adjustment: 300 },
          ],
        },
      ]),
    };

    const result = priceOrderItem(
      multiProduct,
      {
        product_id: 10,
        quantity: 1,
        options: [
          { groupId: 'topping', choiceId: 'shot' },
          { groupId: 'topping', choiceId: 'cream' },
        ],
      },
      1
    );

    expect(result.price).toBe(4800);
    expect(result.options).toHaveLength(2);
  });

  test('rejects a client total that differs from the server total', () => {
    expect(() => assertClientTotal(1, 9400)).toThrow(/가격이 변경/);
    expect(() => assertClientTotal('9400', 9400)).not.toThrow();
  });
});

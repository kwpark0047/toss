const {
  productWireCreateSchema,
  productWireUpdateSchema,
} = require('../../../src/validation/schemas/product');

describe('상품 요청 검증 (관리자 화면 snake_case 호환)', () => {
  test('관리자 화면의 메뉴 추가 요청을 그대로 통과시킨다', () => {
    const body = productWireCreateSchema.parse({
      store_id: 8,
      category_id: '3',
      name: '로스카츠',
      price: 12000,
      options: [{ name: '소스' }],
    });
    expect(body).toMatchObject({ store_id: 8, category_id: 3, name: '로스카츠', price: 12000 });
    expect(body.options).toEqual([{ name: '소스' }]);
  });

  test('품절·카테고리·이미지 수정 값이 지워지지 않는다 (snake·camel 모두)', () => {
    expect(productWireUpdateSchema.parse({ is_sold_out: 1 })).toEqual({ is_sold_out: true });
    expect(productWireUpdateSchema.parse({ isSoldOut: false, categoryId: 2 })).toEqual({
      is_sold_out: false,
      category_id: 2,
    });
  });

  test('매장 ID 없음·음수 가격은 거절한다', () => {
    expect(() => productWireCreateSchema.parse({ name: 'x', price: 1000 })).toThrow();
    expect(() => productWireUpdateSchema.parse({ price: -1 })).toThrow();
  });
});

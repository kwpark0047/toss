const {
  assertOrderStatusTransition,
  assertKdsOrderStatusTransition,
} = require('../../../utils/orderStatus');

describe('order status policy', () => {
  it('공통 주문 상태 전이는 허용된 흐름만 통과시킨다', () => {
    expect(() => assertOrderStatusTransition('pending', 'confirmed')).not.toThrow();
    expect(() => assertOrderStatusTransition('preparing', 'ready')).not.toThrow();
    expect(() => assertOrderStatusTransition('completed', 'preparing')).toThrow('상태에서는');
  });

  it('KDS는 조리 단계 전이만 허용한다', () => {
    expect(() => assertKdsOrderStatusTransition('pending', 'preparing')).not.toThrow();
    expect(() => assertKdsOrderStatusTransition('preparing', 'ready')).not.toThrow();
    expect(() => assertKdsOrderStatusTransition('pending', 'completed')).toThrow('상태에서는');
  });
});

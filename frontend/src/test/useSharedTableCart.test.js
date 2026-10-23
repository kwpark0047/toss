import { describe, it, expect } from 'vitest';
import { toWire, fromWire } from '@/hooks/useSharedTableCart';

describe('공유 장바구니 직렬화', () => {
  const cart = [
    {
      cartItemId: 'a1',
      menuItem: { id: 1, name: '짜장면', price: 8000, description: '긴 설명', category_id: 2 },
      quantity: 2,
      selectedOptions: [{ name: '곱빼기' }],
      unitPrice: 9000,
    },
  ];

  it('필요한 필드만 보내고 다시 받으면 같은 장바구니가 된다', () => {
    const wire = toWire(cart);
    expect(wire[0].menuItem.description).toBeUndefined();
    const back = fromWire(wire, [{ id: 1, name: '짜장면', price: 8000, description: '긴 설명' }]);
    expect(back[0].menuItem.description).toBe('긴 설명');
    expect(back[0]).toMatchObject({ cartItemId: 'a1', quantity: 2, unitPrice: 9000 });
  });

  it('수량 0이나 깨진 항목은 버린다', () => {
    expect(fromWire([{ menuItem: { id: 1 }, quantity: 0 }, null, { quantity: 1 }], [])).toEqual([]);
  });
});

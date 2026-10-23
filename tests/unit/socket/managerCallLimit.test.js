jest.mock('../../../config/prisma', () => ({}));
jest.mock('../../../services/AlimtalkService', () => ({}));
jest.mock('../../../middleware/storeAuth', () => ({ getStoreRole: jest.fn() }));

const { checkManagerCallLimit } = require('../../../socket/handlers');

describe('직원 호출 남용 방지', () => {
  test('같은 기기는 10초 안에 다시 호출할 수 없다', () => {
    const t = 1_000_000;
    expect(checkManagerCallLimit('s1', 101, '1번', t)).toBe(true);
    expect(checkManagerCallLimit('s1', 101, '2번', t + 5_000)).toBe(false);
    expect(checkManagerCallLimit('s1', 101, '2번', t + 11_000)).toBe(true);
  });

  test('같은 테이블은 다른 기기여도 15초 안에 다시 호출할 수 없다', () => {
    const t = 2_000_000;
    expect(checkManagerCallLimit('a', 102, '3번', t)).toBe(true);
    expect(checkManagerCallLimit('b', 102, '3번', t + 1_000)).toBe(false);
    expect(checkManagerCallLimit('b', 102, '3번', t + 16_000)).toBe(true);
  });

  test('매장 전체로는 1분에 30회까지만 받는다', () => {
    const t = 3_000_000;
    for (let i = 0; i < 30; i++) {
      expect(checkManagerCallLimit(`x${i}`, 103, `${i}번`, t + i)).toBe(true);
    }
    expect(checkManagerCallLimit('y', 103, '99번', t + 100)).toBe(false);
  });
});

describe('공유 장바구니 중계 검증', () => {
  const { isValidSharedCart } = require('../../../socket/handlers');
  test('정상 장바구니는 통과', () => {
    expect(isValidSharedCart({ cart: [{ quantity: 1 }], version: 1 })).toBe(true);
  });
  test('항목 수·크기·버전이 잘못되면 거절', () => {
    expect(isValidSharedCart({ cart: new Array(61).fill({}), version: 1 })).toBe(false);
    expect(isValidSharedCart({ cart: [{ x: 'a'.repeat(40000) }], version: 1 })).toBe(false);
    expect(isValidSharedCart({ cart: [], version: 'x' })).toBe(false);
  });
});

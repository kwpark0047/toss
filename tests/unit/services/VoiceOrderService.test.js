const VoiceOrderService = require('../../../services/VoiceOrderService');

describe('VoiceOrderService.fallbackParse', () => {
  const menuItems = [
    { id: 1, name: '아메리카노', price: 3500 },
    { id: 2, name: '카페라떼', price: 4000 },
    { id: 3, name: '토스트', price: 4500 },
  ];

  const parse = (text) => VoiceOrderService.fallbackParse(text, menuItems);

  test('수량 지정이 없으면 기본 수량 1을 반환한다', () => {
    const result = parse('아메리카노 주세요');
    expect(result.items).toEqual([
      expect.objectContaining({ product_id: 1, quantity: 1, options: [] }),
    ]);
  });

  test('아라비아 숫자 + 개 단위 수량을 파싱한다', () => {
    const result = parse('아메리카노 2개 주세요');
    expect(result.items).toEqual([expect.objectContaining({ product_id: 1, quantity: 2 })]);
  });

  test('아라비아 숫자 + 잔 단위 수량을 파싱한다', () => {
    const result = parse('카페라떼 2잔 주세요');
    expect(result.items).toEqual([expect.objectContaining({ product_id: 2, quantity: 2 })]);
  });

  test('한글 수량(한 잔)을 파싱한다', () => {
    const result = parse('아메리카노 한 잔 주세요');
    expect(result.items).toEqual([expect.objectContaining({ product_id: 1, quantity: 1 })]);
  });

  test('복수 메뉴 주문을 각각의 수량과 함께 파싱한다', () => {
    const result = parse('아메리카노 1개랑 카페라떼 2잔 주세요');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({ product_id: 1, quantity: 1, options: [] })
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({ product_id: 2, quantity: 2, options: [] })
    );
  });

  test('메뉴명 뒤 괄호 옵션(샷 추가, 연하게)을 파싱한다', () => {
    const result = parse('아메리카노 (샷 추가, 연하게) 주세요');
    expect(result.items).toEqual([
      expect.objectContaining({ product_id: 1, options: ['샷 추가', '연하게'] }),
    ]);
  });

  test('옵션이 없는 주문은 빈 배열 options를 반환한다', () => {
    const result = parse('토스트 1개 주세요');
    expect(result.items).toEqual([
      expect.objectContaining({ product_id: 3, quantity: 1, options: [] }),
    ]);
  });
});

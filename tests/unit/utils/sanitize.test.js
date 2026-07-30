const { sanitizeRawResponse } = require('../../../utils/sanitize');

describe('sanitizeRawResponse', () => {
  test('card 필드 제거', () => {
    const data = { card: { number: '1234-5678-9012-3456' }, cardPassword: '1234' };
    const out = sanitizeRawResponse(data);
    expect(out.card).toBeUndefined();
    expect(out.cardPassword).toBeUndefined();
  });

  test('secret 필드 제거', () => {
    const data = { secret: 'my-secret-key' };
    expect(sanitizeRawResponse(data).secret).toBeUndefined();
  });

  test('customerKey 필드 제거 (대소문자 구분 없음)', () => {
    const data = { customerKey: 'cus_abc123' };
    expect(sanitizeRawResponse(data).customerKey).toBeUndefined();
  });

  test('customer_key 스네이크 케이스 제거', () => {
    const data = { customer_key: 'cus_abc123' };
    expect(sanitizeRawResponse(data).customer_key).toBeUndefined();
  });

  test('credential 필드 제거', () => {
    const data = { credential: 'password123' };
    expect(sanitizeRawResponse(data).credential).toBeUndefined();
  });

  test('중첩 객체 내 민감 필드 재귀 제거', () => {
    const data = {
      orderId: 'ORD-001',
      card: { number: '1234' },
      metadata: {
        customerKey: 'cus_abc',
      },
    };
    const out = sanitizeRawResponse(data);
    expect(out.orderId).toBe('ORD-001');
    expect(out.card).toBeUndefined();
    expect(out.metadata.customerKey).toBeUndefined();
  });

  test('안전한 필드는 유지', () => {
    const data = {
      paymentKey: 'tviva2025',
      orderName: '아메리카노',
      totalAmount: 4500,
      status: 'DONE',
    };
    expect(sanitizeRawResponse(data)).toEqual(data);
  });

  test('null/undefined 입력은 그대로 반환', () => {
    expect(sanitizeRawResponse(null)).toBeNull();
    expect(sanitizeRawResponse(undefined)).toBeUndefined();
  });

  test('입력 객체를 변경하지 않음 (immutable)', () => {
    const data = { card: { number: '1234' }, name: 'test' };
    const copy = JSON.parse(JSON.stringify(data));
    sanitizeRawResponse(data);
    expect(data).toEqual(copy);
  });
});

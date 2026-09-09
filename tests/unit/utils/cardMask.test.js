const { maskCardNumber, maskPaymentKey, isValidMaskedCard } = require('../../../utils/cardMask');

describe('cardMask 유틸리티', () => {
  describe('maskCardNumber', () => {
    it('정상적인 카드번호를 마스킹한다', () => {
      expect(maskCardNumber('1234567890123456')).toBe('123456******3456');
      expect(maskCardNumber('4111111111111111')).toBe('411111******1111');
      expect(maskCardNumber('5500000000000004')).toBe('550000******0004');
    });

    it('하이픈이 포함된 카드번호를 마스킹한다', () => {
      expect(maskCardNumber('1234-5678-9012-3456')).toBe('123456******3456');
      expect(maskCardNumber('4111-1111-1111-1111')).toBe('411111******1111');
    });

    it('숫자 10자 미만은 마지막 4자리만 반환한다', () => {
      expect(maskCardNumber('12345678')).toBe('****5678');
      expect(maskCardNumber('1234567')).toBe('****4567');
      expect(maskCardNumber('1234')).toBe('****1234');
    });

    it('이미 마스킹된 값을 그대로 반환한다', () => {
      expect(maskCardNumber('123456******3456')).toBe('123456******3456');
      expect(maskCardNumber('****5678')).toBe('****5678');
    });

    it('빈 문자열 또는 null은 null을 반환한다', () => {
      expect(maskCardNumber(null)).toBeNull();
      expect(maskCardNumber(undefined)).toBeNull();
      expect(maskCardNumber('')).toBeNull();
    });

    it('숫자가 아닌 문자가 포함된 경우 무시한다', () => {
      expect(maskCardNumber('abc12345678901234')).toBe('123456******1234');
    });
  });

  describe('maskPaymentKey', () => {
    it('긴 결제 키를 마스킹한다', () => {
      expect(maskPaymentKey('test_sk_1234567890')).toBe('****34567890');
    });

    it('짧은 결제 키는 ****를 반환한다', () => {
      expect(maskPaymentKey('short')).toBe('****');
      expect(maskPaymentKey('12345678')).toBe('****');
    });

    it('null 또는 undefined는 ****를 반환한다', () => {
      expect(maskPaymentKey(null)).toBe('****');
      expect(maskPaymentKey(undefined)).toBe('****');
    });
  });

  describe('isValidMaskedCard', () => {
    it('유효한 마스킹된 카드번호를 검증한다', () => {
      expect(isValidMaskedCard('123456******3456')).toBe(true);
      expect(isValidMaskedCard('411111******1111')).toBe(true);
    });

    it('평문 카드번호(마스킹 없음)는 거부한다', () => {
      expect(isValidMaskedCard('12345678901234')).toBe(false);
      expect(isValidMaskedCard('4111111111111111')).toBe(false);
    });

    it('유효하지 않은 형식을 거부한다', () => {
      expect(isValidMaskedCard('12345******3456')).toBe(false); // 앞자리 4자리
      expect(isValidMaskedCard('1234567*****3456')).toBe(false); // 앞자리 7자리
      expect(isValidMaskedCard('123456******345')).toBe(false); // 뒷자리 3자리
      expect(isValidMaskedCard('123456******34567')).toBe(false); // 뒷자리 5자리
    });

    it('숫자가 아닌 문자는 거부한다', () => {
      expect(isValidMaskedCard('abcdef******3456')).toBe(false);
      expect(isValidMaskedCard('123456******abcd')).toBe(false);
    });

    it('null 또는 문자열이 아닌 경우 거부한다', () => {
      expect(isValidMaskedCard(null)).toBe(false);
      expect(isValidMaskedCard(123456)).toBe(false);
      expect(isValidMaskedCard(undefined)).toBe(false);
    });
  });
});

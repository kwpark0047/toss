/**
 * 카드번호 마스킹 유틸리티
 *
 * 정책: 앞 6자리 + 뒤 4자리 유지, 중간 은폐
 * 형식: 123456******1234
 *
 * @module utils/cardMask
 */

/**
 * 카드번호를 마스킹한다.
 *
 * 정책:
 * - 앞 6자리( BIN 6자리) + 뒤 4자리( 마지막 4자리) 유지
 * - 중간 자리는 '*'로 마스킹
 * - 숫자 10자 미만인 경우 이미 마스킹된 값으로 간주하고 마지막 4자리만 반환
 *
 * @param {string|null|undefined} cardNumber - 마스킹할 카드번호
 * @returns {string|null} 마스킹된 카드번호 또는 null
 *
 * @example
 * maskCardNumber('1234567890123456')  // '123456******3456'
 * maskCardNumber('1234567890')        // '123456******7890'
 * maskCardNumber('12345678')          // '****5678' (이미 마스킹된 값)
 * maskCardNumber(null)                // null
 */
function maskCardNumber(cardNumber) {
  if (cardNumber == null) return null;

  const digits = String(cardNumber).replace(/\D/g, '');

  if (digits.length === 0) return null;

  // 이미 마스킹된 값(숫자 10자 미만)은 마지막 4자리만 반환
  if (digits.length < 10) {
    return `****${digits.slice(-4)}`;
  }

  const firstSix = digits.slice(0, 6);
  const lastFour = digits.slice(-4);
  return `${firstSix}******${lastFour}`;
}

/**
 * 결제 키를 마스킹한다.
 *
 * @param {string|null|undefined} paymentKey - 마스킹할 결제 키
 * @returns {string} 마스킹된 결제 키
 */
function maskPaymentKey(paymentKey) {
  if (typeof paymentKey !== 'string' || paymentKey.length <= 8) return '****';
  return `****${paymentKey.slice(-8)}`;
}

/**
 * 마스킹된 카드번호가 유효한지 검증한다.
 *
 * 유효 조건:
 * - 앞 6자리가 숫자로 시작
 * - 뒤 4자리가 숫자로 끝
 * - 중간이 '*'로 채워져 있음
 *
 * @param {string} masked - 검증할 마스킹된 카드번호
 * @returns {boolean} 유효 여부
 */
function isValidMaskedCard(masked) {
  if (typeof masked !== 'string') return false;
  // 형식: 앞6 + '*'(최소1개) + 뒤4
  return /^\d{6}\*+\d{4}$/.test(masked);
}

module.exports = {
  maskCardNumber,
  maskPaymentKey,
  isValidMaskedCard,
};

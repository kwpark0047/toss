process.env.TOKEN_ENC_KEY = 'test-token-enc-key-32chars-long!!!';

const { encryptToken, decryptToken, isEncrypted } = require('../../../utils/tokenEncryption');

describe('tokenEncryption', () => {
  const TOKEN = 'tviva20250401abc123def456';

  describe('encryptToken / decryptToken', () => {
    test('암호화 후 복호화하면 원본 토큰이 나온다', () => {
      const enc = encryptToken(TOKEN);
      expect(enc).toMatch(/^tenc:[0-9a-f]{32}:[0-9a-f]+$/);
      expect(decryptToken(enc)).toBe(TOKEN);
    });

    test('이미 암호화된 값은 이중 암호화하지 않는다', () => {
      const enc = encryptToken(TOKEN);
      expect(encryptToken(enc)).toBe(enc);
    });

    test('null/빈 값은 그대로 반환', () => {
      expect(encryptToken(null)).toBeNull();
      expect(encryptToken('')).toBe('');
      expect(decryptToken(null)).toBeNull();
      expect(decryptToken('')).toBe('');
    });

    test('암호화되지 않은 평문은 복호화 시 그대로 반환 (하위 호환)', () => {
      expect(decryptToken(TOKEN)).toBe(TOKEN);
    });

    test('손상된 암호문은 예외 없이 원본 문자열 반환', () => {
      expect(decryptToken('tenc:zzzz:not-hex')).toBe('tenc:zzzz:not-hex');
      expect(decryptToken('tenc:only-one-part')).toBe('tenc:only-one-part');
    });

    test('매 암호화마다 다른 IV로 다른 암호문 생성', () => {
      const enc1 = encryptToken(TOKEN);
      const enc2 = encryptToken(TOKEN);
      expect(enc1.split(':')[1]).not.toBe(enc2.split(':')[1]);
    });
  });

  describe('isEncrypted', () => {
    test('tenc: 접두사 판별', () => {
      expect(isEncrypted(encryptToken(TOKEN))).toBe(true);
      expect(isEncrypted(TOKEN)).toBe(false);
      expect(isEncrypted(null)).toBe(false);
    });
  });
});

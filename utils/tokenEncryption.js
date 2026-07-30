const crypto = require('crypto');

const _ikm = process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET || '';
if (!_ikm || _ikm.length < 16) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[tokenEncryption] TOKEN_ENC_KEY 또는 JWT_SECRET(16자 이상)이 설정되지 않았습니다.'
    );
  }
}

const hkdf = (info) =>
  _ikm
    ? Buffer.from(crypto.hkdfSync('sha256', Buffer.from(_ikm), 'wemarket-token-salt', info, 32))
    : null;

const ENC_KEY = hkdf('token-enc');
const PREFIX = 'tenc:';

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

const encryptToken = (token) => {
  if (!token || isEncrypted(token)) return token;
  if (!ENC_KEY) return token;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = cipher.update(String(token), 'utf8', 'hex') + cipher.final('hex');
  return `${PREFIX}${iv.toString('hex')}:${encrypted}`;
};

const decryptToken = (stored) => {
  if (!stored || !isEncrypted(stored)) return stored;
  if (!ENC_KEY) return stored;
  try {
    const parts = stored.slice(PREFIX.length).split(':');
    if (parts.length !== 2) return stored;
    const iv = Buffer.from(parts[0], 'hex');
    const cipherText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
    return decipher.update(cipherText, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return stored;
  }
};

module.exports = { encryptToken, decryptToken, isEncrypted };

const crypto = require('crypto');
const { AppError } = require('./errorHandler');
function key() {
  const source =
    process.env.PROVIDER_SECRET_KEY || process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET;
  if (!source || source.length < 16)
    throw new AppError('서버의 인증정보 암호화 키 설정이 필요합니다.', 503);
  return Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(source), 'wemarket-provider-secrets', 'aes-gcm-v1', 32)
  );
}
function seal(value, context) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
function open(value, context) {
  try {
    const bytes = Buffer.from(value, 'base64'),
      decipher = crypto.createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
    );
  } catch {
    throw new AppError('저장된 인증정보를 복호화할 수 없습니다. 서버 키 설정을 확인하세요.', 503);
  }
}
module.exports = { seal, open };

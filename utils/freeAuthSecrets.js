const crypto = require('node:crypto');
const { AppError } = require('./errorHandler');
function key(env = process.env) {
  if (!env.EMAIL_AUTH_PEPPER || env.EMAIL_AUTH_PEPPER.length < 32)
    throw new AppError('인증 암호화 설정을 확인해 주세요.', 503);
  return crypto.createHash('sha256').update(env.EMAIL_AUTH_PEPPER).digest();
}
function digest(purpose, value, env = process.env) {
  return crypto.createHmac('sha256', key(env)).update(`${purpose}:${value}`).digest('hex');
}
function seal(value, aad, env = process.env) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key(env), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}
function open(value, aad, env = process.env) {
  const [iv, tag, data] = value.split('.').map((x) => Buffer.from(x, 'base64url'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(env), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
}
module.exports = { digest, seal, open };

const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');
const credentials = require('../services/ProviderCredentialService');
async function sendViaCoolsms(to, text) {
  const config = await credentials.resolve('coolsms');
  if (!config) throw new Error('SMS 공급자 설정이 없거나 비활성화되었습니다.');
  const { api_key: apiKey, api_secret: apiSecret, sender } = config.values;
  if (!/^\d{8,11}$/.test(sender || '') || !/^\d{10,11}$/.test(to || '') || !text?.trim())
    throw new Error('SMS 번호와 문구를 확인하세요.');
  const salt = crypto.randomBytes(16).toString('hex'),
    timestamp = new Date().toISOString();
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${timestamp}${salt}`)
    .digest('hex');
  const response = await axios.post(
    'https://api.coolsms.co.kr/messages/v4/send',
    { message: { to, from: sender, text, type: 'SMS' } },
    {
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    }
  );
  if (response.data?.statusCode && String(response.data.statusCode) !== '2000')
    throw new Error('SMS 공급자가 발송을 거부했습니다.');
  if (!response.data?.messageId) throw new Error('SMS 공급자 접수 ID를 확인하지 못했습니다.');
  return response.data;
}
async function sendSms(phone, text) {
  if (process.env.NODE_ENV !== 'production') return { dev: true, sent: false };
  try {
    const result = await sendViaCoolsms(phone, text);
    logger.info('[SMS] 공급자 접수 완료');
    return { sent: true, messageId: result.messageId, delivered: false };
  } catch {
    logger.error('[SMS] 공급자 접수 실패');
    return { sent: false, error: 'SMS 설정 또는 공급자 접수를 확인하세요.' };
  }
}
module.exports = { sendSms, sendViaCoolsms };

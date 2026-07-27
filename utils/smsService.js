const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * SMS 발송 서비스
 * - 개발 환경: 콘솔 출력
 * - 운영 환경: Coolsms API 연동 (SMS_ENV=coolsms)
 *   환경변수: SMS_API_KEY, SMS_API_SECRET, SMS_SENDER
 *
 * 향후 NHN Cloud / Toast SMS 등으로 확장 시 sendSms 내부만 교체
 */

const COOLSMS_API_URL = 'https://api.coolsms.co.kr';
const SMS_ENV = process.env.SMS_ENV || 'none';

function makeCoolsmsSignature(apiSecret, salt, timestamp) {
  return crypto.createHmac('sha256', apiSecret)
    .update(`${timestamp}${salt}`)
    .digest('hex');
}

async function sendViaCoolsms(to, text) {
  const apiKey = process.env.SMS_API_KEY;
  const apiSecret = process.env.SMS_API_SECRET;
  const sender = process.env.SMS_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    throw new Error('Coolsms 환경변수가 설정되지 않았습니다. SMS_API_KEY, SMS_API_SECRET, SMS_SENDER를 확인하세요.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const signature = makeCoolsmsSignature(apiSecret, salt, timestamp);

  const res = await axios.post(`${COOLSMS_API_URL}/messages/v4/send`, {
    message: {
      to,
      from: sender,
      text,
      type: 'SMS'
    }
  }, {
    headers: {
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

async function sendSms(phone, text) {
  if (IS_DEV || SMS_ENV === 'none') {
    logger.info(`[DEV SMS] → ${phone}: ${text}`);
    return { dev: true };
  }

  try {
    // Coolsms (기본)
    if (SMS_ENV === 'coolsms') {
      const result = await sendViaCoolsms(phone, text);
      logger.info(`[SMS] 발송 성공 → ${phone}: ${text.substring(0, 20)}...`);
      return { sent: true, messageId: result.messageId };
    }

    // 기타 SMS 프로바이더는 이곳에 확장
    // if (SMS_ENV === 'nhncloud') { ... }

    logger.warn(`[SMS] 알 수 없는 SMS_ENV(${SMS_ENV}), 로거로 대체`);
    logger.info(`[SMS] → ${phone}: ${text}`);
    return { fallback: true };
  } catch (err) {
    logger.error('[SMS] 발송 실패:', err.response?.data || err.message);
    // OTP 발송 실패는 치명적이지 않으므로 에러를 던지지 않고 로깅
    return { sent: false, error: err.message };
  }
}

module.exports = { sendSms, sendViaCoolsms };

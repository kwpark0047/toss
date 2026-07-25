/**
 * apiKey.js — Open API 키 생성·검증
 *
 * 키 형식: wm_live_<32 hex>  (평문은 발급 시 1회만 반환)
 * DB에는 SHA-256 해시만 저장한다(평문 비저장). prefix(앞 16자)는 UI 식별용.
 */
const crypto = require('crypto');

const PREFIX = 'wm_live_';

/** 새 API 키 발급 — { plaintext, prefix, hash } */
const generateApiKey = () => {
    const secret = crypto.randomBytes(24).toString('hex'); // 48 chars
    const plaintext = PREFIX + secret;
    return {
        plaintext,
        prefix: plaintext.slice(0, 16),
        hash: hashApiKey(plaintext),
    };
};

/** 키 → SHA-256 hex (DB 저장/조회용) */
const hashApiKey = (plaintext) =>
    crypto.createHash('sha256').update(String(plaintext || '')).digest('hex');

/** 요청 헤더에서 API 키 추출 (Authorization: Bearer 또는 X-API-Key) */
const extractApiKey = (req) => {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ') && auth.slice(7).startsWith(PREFIX)) return auth.slice(7).trim();
    const x = req.headers['x-api-key'];
    if (x && String(x).startsWith(PREFIX)) return String(x).trim();
    return null;
};

module.exports = { PREFIX, generateApiKey, hashApiKey, extractApiKey };

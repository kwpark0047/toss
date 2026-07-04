/**
 * phoneEncryption.js
 * AES-256-CBC 결정론적 암호화 — 동일 입력 → 동일 암호문 (DB 검색 가능)
 * IV = HMAC-SHA256(phone, HMAC_KEY)[0:16] → 전화번호별 고정 IV
 * 형식: enc:<iv_hex>:<cipher_hex>
 */
const crypto = require('crypto');

const ENC_KEY  = Buffer.from(process.env.PHONE_ENC_KEY  || '', 'hex'); // 32 bytes
const HMAC_KEY = process.env.PHONE_HMAC_KEY || '';

const PREFIX = 'enc:';

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

/**
 * 전화번호 암호화 (이미 암호화된 값은 그대로 반환)
 */
const encryptPhone = (phone) => {
    if (!phone || isEncrypted(phone)) return phone;
    if (!ENC_KEY.length || !HMAC_KEY) return phone; // 키 미설정 시 평문 유지

    const normalized = phone.replace(/[^0-9]/g, '');
    if (!normalized) return phone;

    const iv = crypto.createHmac('sha256', HMAC_KEY).update(normalized).digest().slice(0, 16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
    const encrypted = cipher.update(normalized, 'utf8', 'hex') + cipher.final('hex');

    return PREFIX + iv.toString('hex') + ':' + encrypted;
};

/**
 * 전화번호 복호화 (암호화되지 않은 값은 그대로 반환 — 하위 호환)
 */
const decryptPhone = (stored) => {
    if (!stored || !isEncrypted(stored)) return stored;
    if (!ENC_KEY.length || !HMAC_KEY) return stored;

    try {
        const parts = stored.slice(PREFIX.length).split(':');
        if (parts.length !== 2) return stored;

        const iv         = Buffer.from(parts[0], 'hex');
        const cipherText = parts[1];
        const decipher   = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
        return decipher.update(cipherText, 'hex', 'utf8') + decipher.final('utf8');
    } catch {
        return stored;
    }
};

/**
 * 로그인/검색용: 입력 전화번호를 암호화해서 반환
 * DB의 암호화된 값과 비교 가능
 */
const encryptPhoneForSearch = (phone) => {
    const normalized = phone.replace(/[^0-9]/g, '');
    return encryptPhone(normalized);
};

/**
 * 응답 객체의 phone 필드 자동 복호화
 */
const decryptPhoneFields = (obj, fields = ['phone', 'customer_phone']) => {
    if (!obj) return obj;
    const result = { ...obj };
    for (const f of fields) {
        if (result[f]) result[f] = decryptPhone(result[f]);
    }
    return result;
};

module.exports = { encryptPhone, decryptPhone, encryptPhoneForSearch, decryptPhoneFields, isEncrypted };

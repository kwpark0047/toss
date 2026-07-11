"use strict";
/**
 * phoneEncryption.js
 * AES-256-CBC 결정론적 암호화 — 동일 입력 → 동일 암호문 (DB 검색 가능)
 * IV = HMAC-SHA256(phone, HMAC_KEY)[0:16] → 전화번호별 고정 IV
 * 형식: enc:<iv_hex>:<cipher_hex>
 */
const crypto = require('crypto');
// IKM: PHONE_ENC_KEY 우선, 없으면 JWT_SECRET 폴백 (최소 16자 요구)
const _ikm = process.env.PHONE_ENC_KEY || process.env.JWT_SECRET || '';
if (!_ikm || _ikm.length < 16) {
    // 운영 환경에서는 서버 시작 실패 처리
    if (process.env.NODE_ENV === 'production') {
        throw new Error('[phoneEncryption] PHONE_ENC_KEY 또는 JWT_SECRET(16자 이상)이 설정되지 않았습니다.');
    }
}
// HKDF로 독립 키 도출 (IKM 재사용 방지)
// 주의: crypto.hkdfSync는 ArrayBuffer를 반환하므로 반드시 Buffer.from으로 감싸야
// .toString('hex')가 올바르게 동작한다.
const hkdf = (info) => _ikm ? Buffer.from(crypto.hkdfSync('sha256', Buffer.from(_ikm), 'wemarket-phone-salt', info, 32)) : null;
const ENC_KEY = hkdf('phone-enc');
const HMAC_KEY = ENC_KEY ? hkdf('phone-hmac').toString('hex') : null;
// 레거시 호환: 과거 코드가 ArrayBuffer.toString('hex')를 호출해 HMAC 키가
// 문자열 "[object ArrayBuffer]"로 고정되어 있었다. 그 키로 IV가 생성된
// 기존 DB 레코드를 계속 검색할 수 있도록 유지한다.
const LEGACY_HMAC_KEY = '[object ArrayBuffer]';
const PREFIX = 'enc:';
const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);
// 전화번호에서 숫자만 남긴다 (여러 모듈에 흩어져 있던 정규화 로직 통합)
const normalizePhone = (phone) => String(phone || '').replace(/[^0-9]/g, '');
const encryptWithIvKey = (normalized, ivKey) => {
    const iv = crypto.createHmac('sha256', ivKey).update(normalized).digest().slice(0, 16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
    const encrypted = cipher.update(normalized, 'utf8', 'hex') + cipher.final('hex');
    return PREFIX + iv.toString('hex') + ':' + encrypted;
};
/**
 * 전화번호 암호화 (이미 암호화된 값은 그대로 반환)
 */
const encryptPhone = (phone) => {
    if (!phone || isEncrypted(phone))
        return phone;
    if (!ENC_KEY || !HMAC_KEY)
        return phone; // 키 미설정 시 평문 유지
    const normalized = normalizePhone(phone);
    if (!normalized)
        return phone;
    return encryptWithIvKey(normalized, HMAC_KEY);
};
/**
 * 전화번호 복호화 (암호화되지 않은 값은 그대로 반환 — 하위 호환)
 * IV는 저장값에 포함되어 있어 HMAC 키 변경과 무관하게 동작한다.
 */
const decryptPhone = (stored) => {
    if (!stored || !isEncrypted(stored))
        return stored;
    if (!ENC_KEY)
        return stored;
    try {
        const parts = stored.slice(PREFIX.length).split(':');
        if (parts.length !== 2)
            return stored;
        const iv = Buffer.from(parts[0], 'hex');
        const cipherText = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
        return decipher.update(cipherText, 'hex', 'utf8') + decipher.final('utf8');
    }
    catch {
        return stored;
    }
};
/**
 * 로그인/검색용: 입력 전화번호를 암호화해서 반환
 * DB의 암호화된 값과 비교 가능
 */
const encryptPhoneForSearch = (phone) => {
    return encryptPhone(normalizePhone(phone));
};
/**
 * 검색 후보군: [현행 암호문, 레거시 암호문, 평문] — Prisma `{ in: [...] }`에 사용.
 * 레거시 IV 키로 저장된 기존 레코드와 평문(마이그레이션 전) 레코드를 모두 커버한다.
 */
const phoneSearchCandidates = (phone) => {
    const normalized = normalizePhone(phone);
    if (!normalized)
        return [];
    const candidates = [normalized];
    if (ENC_KEY && HMAC_KEY) {
        candidates.unshift(encryptWithIvKey(normalized, LEGACY_HMAC_KEY));
        candidates.unshift(encryptWithIvKey(normalized, HMAC_KEY));
    }
    return [...new Set(candidates)];
};
/**
 * 응답 객체의 phone 필드 자동 복호화
 */
const decryptPhoneFields = (obj, fields = ['phone', 'customer_phone']) => {
    if (!obj)
        return obj;
    const result = { ...obj };
    for (const f of fields) {
        if (result[f])
            result[f] = decryptPhone(result[f]);
    }
    return result;
};
module.exports = { normalizePhone, encryptPhone, decryptPhone, encryptPhoneForSearch, phoneSearchCandidates, decryptPhoneFields, isEncrypted };

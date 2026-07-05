/**
 * phoneEncryption 단위 테스트
 *
 * 회귀 방지 핵심: crypto.hkdfSync는 ArrayBuffer를 반환하므로
 * Buffer.from 없이 .toString('hex')를 호출하면 "[object ArrayBuffer]"라는
 * 상수 문자열이 HMAC 키로 사용되는 버그가 있었다.
 */

// 키가 결정론적이도록 테스트 전용 IKM 고정 (모듈 로드 전에 설정)
process.env.PHONE_ENC_KEY = 'test-phone-enc-key-32chars-long!';

const crypto = require('crypto');
const {
    normalizePhone,
    encryptPhone,
    decryptPhone,
    encryptPhoneForSearch,
    phoneSearchCandidates,
    decryptPhoneFields,
    isEncrypted,
} = require('../../../utils/phoneEncryption');

describe('phoneEncryption', () => {
    const PHONE = '01012345678';

    describe('normalizePhone', () => {
        test('하이픈·공백·문자를 제거하고 숫자만 남긴다', () => {
            expect(normalizePhone('010-1234-5678')).toBe('01012345678');
            expect(normalizePhone('010 1234 5678')).toBe('01012345678');
            expect(normalizePhone('+82 10-1234-5678')).toBe('821012345678');
        });
        test('null/undefined/빈값은 빈 문자열', () => {
            expect(normalizePhone(null)).toBe('');
            expect(normalizePhone(undefined)).toBe('');
            expect(normalizePhone('')).toBe('');
        });
    });

    describe('encryptPhone / decryptPhone 왕복', () => {
        test('암호화 후 복호화하면 원본 번호가 나온다', () => {
            const enc = encryptPhone(PHONE);
            expect(enc).toMatch(/^enc:[0-9a-f]{32}:[0-9a-f]+$/);
            expect(decryptPhone(enc)).toBe(PHONE);
        });

        test('결정론적: 같은 번호는 항상 같은 암호문 (DB 검색 가능)', () => {
            expect(encryptPhone(PHONE)).toBe(encryptPhone(PHONE));
        });

        test('하이픈 포함 번호도 정규화 후 동일 암호문', () => {
            expect(encryptPhone('010-1234-5678')).toBe(encryptPhone(PHONE));
        });

        test('이미 암호화된 값은 이중 암호화하지 않는다', () => {
            const enc = encryptPhone(PHONE);
            expect(encryptPhone(enc)).toBe(enc);
        });

        test('null/빈 값은 그대로 반환', () => {
            expect(encryptPhone(null)).toBeNull();
            expect(encryptPhone('')).toBe('');
            expect(decryptPhone(null)).toBeNull();
        });

        test('암호화되지 않은 평문은 복호화 시 그대로 반환 (하위 호환)', () => {
            expect(decryptPhone(PHONE)).toBe(PHONE);
        });

        test('손상된 암호문은 예외 없이 원본 문자열 반환', () => {
            expect(decryptPhone('enc:zzzz:not-hex')).toBe('enc:zzzz:not-hex');
            expect(decryptPhone('enc:only-one-part')).toBe('enc:only-one-part');
        });
    });

    describe('HMAC 키 도출 회귀 방지 (ArrayBuffer 버그)', () => {
        test('IV가 "[object ArrayBuffer]" 상수 키로 생성되지 않는다', () => {
            // 버그 재현: 상수 키로 IV를 계산
            const buggyIv = crypto
                .createHmac('sha256', '[object ArrayBuffer]')
                .update(PHONE)
                .digest()
                .slice(0, 16)
                .toString('hex');

            const enc = encryptPhone(PHONE);
            const actualIv = enc.split(':')[1];
            expect(actualIv).not.toBe(buggyIv);
        });

        test('IKM이 다르면 IV도 달라진다 (키 종속성 확인)', () => {
            // 현재 프로세스의 IV
            const iv1 = encryptPhone(PHONE).split(':')[1];
            // 다른 IKM으로 직접 도출한 IV
            const otherHmacKey = Buffer.from(
                crypto.hkdfSync('sha256', Buffer.from('another-ikm-key-32chars-long!!!!'), 'wemarket-phone-salt', 'phone-hmac', 32)
            ).toString('hex');
            const iv2 = crypto.createHmac('sha256', otherHmacKey).update(PHONE).digest().slice(0, 16).toString('hex');
            expect(iv1).not.toBe(iv2);
        });
    });

    describe('phoneSearchCandidates (레거시 호환 검색)', () => {
        test('현행·레거시·평문 3종 후보를 반환한다', () => {
            const cands = phoneSearchCandidates(PHONE);
            expect(cands).toHaveLength(3);
            expect(cands[0]).toBe(encryptPhoneForSearch(PHONE)); // 현행
            expect(cands[1]).toMatch(/^enc:/);                    // 레거시
            expect(cands[2]).toBe(PHONE);                         // 평문
            expect(cands[0]).not.toBe(cands[1]);                  // IV가 달라야 함
        });

        test('레거시 후보는 "[object ArrayBuffer]" 키의 IV를 재현한다', () => {
            const legacyIv = crypto
                .createHmac('sha256', '[object ArrayBuffer]')
                .update(PHONE)
                .digest()
                .slice(0, 16)
                .toString('hex');
            const cands = phoneSearchCandidates(PHONE);
            expect(cands[1].split(':')[1]).toBe(legacyIv);
        });

        test('레거시 암호문도 복호화 가능 (IV는 저장값에서 읽음)', () => {
            const cands = phoneSearchCandidates(PHONE);
            expect(decryptPhone(cands[1])).toBe(PHONE);
        });

        test('하이픈 입력도 정규화되어 동일 후보군', () => {
            expect(phoneSearchCandidates('010-1234-5678')).toEqual(phoneSearchCandidates(PHONE));
        });

        test('빈 입력은 빈 배열', () => {
            expect(phoneSearchCandidates('')).toEqual([]);
            expect(phoneSearchCandidates(null)).toEqual([]);
        });
    });

    describe('decryptPhoneFields', () => {
        test('객체의 phone 필드들을 자동 복호화한다', () => {
            const obj = { id: 1, phone: encryptPhone(PHONE), customer_phone: encryptPhone('01099998888'), name: '홍길동' };
            const out = decryptPhoneFields(obj);
            expect(out.phone).toBe(PHONE);
            expect(out.customer_phone).toBe('01099998888');
            expect(out.name).toBe('홍길동');
        });

        test('null 객체는 그대로 반환', () => {
            expect(decryptPhoneFields(null)).toBeNull();
        });
    });

    describe('isEncrypted', () => {
        test('enc: 접두사 판별', () => {
            expect(isEncrypted(encryptPhone(PHONE))).toBe(true);
            expect(isEncrypted(PHONE)).toBe(false);
            expect(isEncrypted(null)).toBe(false);
        });
    });
});

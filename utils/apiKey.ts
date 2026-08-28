import { Request } from 'express';
import crypto from 'crypto';

const PREFIX = 'wm_live_';

/** 새 API 키 발급 — { plaintext, prefix, hash } */
export const generateApiKey = () => {
    const secret = crypto.randomBytes(24).toString('hex'); // 48 chars
    const plaintext = PREFIX + secret;
    return {
        plaintext,
        prefix: plaintext.slice(0, 16),
        hash: hashApiKey(plaintext),
    };
};

/** 키 → SHA-256 hex (DB 저장/조회용) */
export const hashApiKey = (plaintext: string): string =>
    crypto.createHash('sha256').update(String(plaintext || '')).digest('hex');

/** 요청 헤더에서 API 키 추출 (Authorization: Bearer 또는 X-API-Key) */
export const extractApiKey = (req: { headers: Record<string, string | string[] | undefined> }): string | null => {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ') && auth.slice(7).startsWith(PREFIX)) return auth.slice(7).trim();
    const x = req.headers['x-api-key'];
    if (x && String(x).startsWith(PREFIX)) return String(x).trim();
    return null;
};

export const PREFIX: string;
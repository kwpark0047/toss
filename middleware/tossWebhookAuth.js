const crypto = require('crypto');
const logger = require('../utils/logger');

// ═════════════════════════════════════════════════════════════════
// [보안] 토스페이먼츠 웹훅 검증 미들웨어 (계층적 검증)
// ═════════════════════════════════════════════════════════════════
// 결제 웹훅(PAYMENT_STATUS_CHANGED, DEPOSIT_CALLBACK 등)은 인증 헤더·서명을
// 전송하지 않는다(tosspayments-webhook-signature는 지급대행 payout.changed/
// seller.changed에만 존재). 따라서 Basic 인증 강제 대신 아래 계층으로 검증한다:
//   ① 공유 시크릿   TOSS_WEBHOOK_SECRET  — x-webhook-secret 헤더 또는 ?secret=
//   ② IP 화이트리스트 TOSS_WEBHOOK_IPS    — 쉼표 구분, IPv4 CIDR 지원
//   ③ 레거시 호환   Basic base64(TOSS_SECRET_KEY:)
// 어느 계층도 설정되지 않으면 통과시키되, 컨트롤러의 서버측 재검증(결제 조회 API)이
// 최종 방어선으로 작동한다. 운영 환경에서는 ① 또는 ② 설정을 권장한다.
// 재전송 폭주 대비 /api 전역 rate limiter가 함께 적용된다.

let warnedUnconfigured = false;

const normalizeIp = (ip = '') =>
  String(ip)
    .replace(/^::ffff:/, '')
    .trim();

// 길이 노출 없는 안전한 문자열 비교
const timingSafeEqualStr = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const ipv4ToInt = (ip) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out >>> 0;
};

const ipMatchesEntry = (ip, entry) => {
  if (!entry.includes('/')) return ip === entry;
  const [range, bitsRaw] = entry.split('/');
  // IPv6 CIDR은 미지원(정확 매칭만)
  if (range.includes(':') || ip.includes(':')) return ip === range && bitsRaw === '128';
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const rangeInt = ipv4ToInt(range);
  const ipInt = ipv4ToInt(ip);
  if (rangeInt === null || ipInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (rangeInt & mask) >>> 0 === (ipInt & mask) >>> 0;
};

const tossWebhookAuth = (req, res, next) => {
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  const ipsRaw = process.env.TOSS_WEBHOOK_IPS;

  // 검증 계층 미설정: 서버측 재검증에 의존하고 경고 1회 출력
  if (!secret && !ipsRaw) {
    if (!warnedUnconfigured && process.env.NODE_ENV === 'production') {
      logger.warn(
        '[Webhook/Toss] 검증 계층 미설정 - TOSS_WEBHOOK_SECRET 또는 TOSS_WEBHOOK_IPS 설정 권장'
      );
      warnedUnconfigured = true;
    }
    return next();
  }

  // ① 공유 시크릿
  if (secret) {
    const provided = req.get('x-webhook-secret') || req.query?.secret;
    if (provided && timingSafeEqualStr(provided, secret)) return next();
  }

  // ② 소스 IP 화이트리스트
  if (ipsRaw) {
    const clientIp = normalizeIp(req.ip);
    const allowedEntries = ipsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (clientIp && allowedEntries.some((entry) => ipMatchesEntry(clientIp, entry))) {
      return next();
    }
  }

  // ③ 레거시 호환: 기존 Basic 인증 연동 도구 허용
  const legacyKey = process.env.TOSS_SECRET_KEY;
  if (legacyKey) {
    const expectedLegacy = 'Basic ' + Buffer.from(legacyKey + ':').toString('base64');
    const auth = req.headers['authorization'] || '';
    if (auth && timingSafeEqualStr(auth, expectedLegacy)) return next();
  }

  logger.warn('[Webhook/Toss] 웹훅 검증 실패 - 요청 거부', { ip: normalizeIp(req.ip) });
  return res.status(401).end();
};

module.exports = tossWebhookAuth;

const crypto = require('crypto');
const logger = require('../utils/logger');

// ═════════════════════════════════════════════════════════════════
// [보안] 토스페이먼츠 웹훅 검증 미들웨어 (계층적 검증 + 서명 검증)
// ═════════════════════════════════════════════════════════════════
// 결제 웹훅(PAYMENT_STATUS_CHANGED, DEPOSIT_CALLBACK 등)은 인증 헤더·서명을
// 전송하지 않는다(tosspayments-webhook-signature는 지급대행 payout.changed/
// seller.changed에만 존재). 따라서 Basic 인증 강제 대신 아래 계층으로 검증한다:
//   ① 공유 시크릿   TOSS_WEBHOOK_SECRET  — x-webhook-secret 헤더 또는 ?secret=
//   ② IP 화이트리스트 TOSS_WEBHOOK_IPS    — 쉼표 구분, IPv4 CIDR 지원
//   ③ 레거시 호환   Basic base64(TOSS_SECRET_KEY:)
//   ④ 서명 검증     tosspayments-webhook-signature 헤더 — HMAC-SHA256 (지급대행/매장변경 이벤트용)
//
// [deny-by-default] 운영 환경에서 검증 계층 ①~④가 하나도 설정되지 않은 요청은
// 거부한다(503 — 토스가 재전송하므로 결제 유실 없음). 일시 마이그레이션이 필요하면
// TOSS_WEBHOOK_ALLOW_UNSIGNED=true 로 옵트아웃한다. 개발/테스트 환경에서는
// 경고 1회 후 통과시킨다(로컬 Swagger·테스트 목적).
// 컨트롤러의 서버측 재검증(결제 조회 API)이 최종 방어선으로 작동한다.
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

/**
 * Toss 웹훅 서명 검증 (HMAC-SHA256)
 * tosspayments-webhook-signature 헤더: v1=<signature>,ts=<timestamp>
 * 서명 = HMAC-SHA256(TOSS_WEBHOOK_SIGNING_SECRET, `${timestamp}.${rawBody}`)
 * 반환: true=서명 유효(통과), false=서명 실패(거부), 'unconfigured'=검증 미설정(다음 계층 진행)
 */
const verifyTossWebhookSignature = (req) => {
  const signingSecret = process.env.TOSS_WEBHOOK_SIGNING_SECRET;
  // 서명 검증 미설정 → 서명 계층 미적용(① ② ③ 계층으로 계속 진행). true 를 반환해
  // 뒤의 공유 시크릿/IP 화이트리스트 검증을 우회하면 안 된다.
  if (!signingSecret) return 'unconfigured';

  const signatureHeader = req.get('tosspayments-webhook-signature');
  if (!signatureHeader) return false;

  // v1=<signature>,ts=<timestamp> 파싱
  const parts = signatureHeader.split(',');
  let signature = null;
  let timestamp = null;
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'v1') signature = value;
    if (key === 'ts') timestamp = value;
  }
  if (!signature || !timestamp) return false;

  // 타임스탬프 검증 (5분 이내)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

  // Raw body 필요 (express.raw() 미들웨어로 저장되어야 함)
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(expectedPayload)
    .digest('hex');

  return timingSafeEqualStr(signature, expectedSignature);
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
  const legacyKey = process.env.TOSS_SECRET_KEY;

  // ④ 서명 검증 (최우선 - 지급대행/매장변경 이벤트용)
  const signatureResult = verifyTossWebhookSignature(req);
  if (signatureResult === true) return next();
  if (signatureResult === false) {
    logger.warn('[Webhook/Toss] 웹훅 서명 검증 실패 - 요청 거부', { ip: normalizeIp(req.ip) });
    return res.status(401).end();
  }
  // 서명 검증 미설정(unconfigured) → ① ② ③ 계층으로 계속 진행

  // 검증 계층 미설정:
  //  - 프로덕션: deny-by-default (503 → 토스 재전송). TOSS_WEBHOOK_ALLOW_UNSIGNED=true 로 옵트아웃 가능
  //  - 개발/테스트: 경고 1회 출력 후 통과 (서버측 재검증 방어선 유지)
  const hasAnyConfig = Boolean(secret || ipsRaw || legacyKey);
  if (!hasAnyConfig) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.TOSS_WEBHOOK_ALLOW_UNSIGNED !== 'true'
    ) {
      logger.error(
        '[Webhook/Toss] 프로덕션에서 웹훅 검증 계층 미설정으로 요청 거부 - ' +
          'TOSS_WEBHOOK_SECRET, TOSS_WEBHOOK_IPS, TOSS_WEBHOOK_SIGNING_SECRET 또는 ' +
          'TOSS_WEBHOOK_ALLOW_UNSIGNED 설정 필요',
        { ip: normalizeIp(req.ip) }
      );
      return res
        .status(503)
        .set('Retry-After', '60')
        .json({ success: false, error: 'Webhook verification is not configured.' });
    }
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
  if (legacyKey) {
    const expectedLegacy = 'Basic ' + Buffer.from(legacyKey + ':').toString('base64');
    const auth = req.headers['authorization'] || '';
    if (auth && timingSafeEqualStr(auth, expectedLegacy)) return next();
  }

  logger.warn('[Webhook/Toss] 웹훅 검증 실패 - 요청 거부', { ip: normalizeIp(req.ip) });
  return res.status(401).end();
};

module.exports = tossWebhookAuth;

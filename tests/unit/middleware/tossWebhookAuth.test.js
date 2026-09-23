const crypto = require('crypto');

jest.mock('../../../utils/logger');

const tossWebhookAuth = require('../../../middleware/tossWebhookAuth');

// 실제 서명 문자열 생성 — 서명 검증 분기 최대한 통합 경로로 검증
const signWebhook = (rawBody, secret, secondsAgo = 0, version = 'v1') => {
  const ts = Math.floor(Date.now() / 1000) - secondsAgo;
  const signature = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return `${version}=${signature},ts=${ts}`;
};

describe('tossWebhookAuth middleware', () => {
  let req, res, next;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.TOSS_WEBHOOK_SECRET;
    delete process.env.TOSS_WEBHOOK_SIGNING_SECRET;
    delete process.env.TOSS_WEBHOOK_IPS;
    delete process.env.TOSS_SECRET_KEY;
    delete process.env.TOSS_WEBHOOK_ALLOW_UNSIGNED;
    req = { get: jest.fn(() => undefined), headers: {}, query: {}, body: {}, ip: '203.0.113.10' };
    res = { status: jest.fn(() => res), json: jest.fn(), end: jest.fn(), set: jest.fn(() => res) };
    next = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('서명 검증 (④ tosspayments-webhook-signature)', () => {
    const rawBody = '{"eventType":"PAYOUT_STATUS_CHANGED"}';

    test('유효한 서명이면 next() 호출', () => {
      process.env.TOSS_WEBHOOK_SIGNING_SECRET = 'sig-secret';
      req.rawBody = Buffer.from(rawBody);
      req.get.mockReturnValue(signWebhook(rawBody, 'sig-secret'));

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('잘못된 서명이면 401 거부', () => {
      process.env.TOSS_WEBHOOK_SIGNING_SECRET = 'sig-secret';
      req.rawBody = Buffer.from(rawBody);
      req.get.mockReturnValue(signWebhook(rawBody, 'wrong-secret'));

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('5분 초과 타임스탬프는 만료로 401 거부', () => {
      process.env.TOSS_WEBHOOK_SIGNING_SECRET = 'sig-secret';
      req.rawBody = Buffer.from(rawBody);
      req.get.mockReturnValue(signWebhook(rawBody, 'sig-secret', 301));

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('서명 헤더 파싱 불가(v1/ts 누락) 시 401 거부', () => {
      process.env.TOSS_WEBHOOK_SIGNING_SECRET = 'sig-secret';
      req.rawBody = Buffer.from(rawBody);
      req.get.mockReturnValue('v1=abc');

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('deny-by-default (검증 계층 미설정)', () => {
    test('프로덕션 + 계층 미설정 → 503 재시도 응답 (토스 재전송 유도)', () => {
      process.env.NODE_ENV = 'production';

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
      expect(next).not.toHaveBeenCalled();
    });

    test('프로덕션 + TOSS_WEBHOOK_ALLOW_UNSIGNED=true → 통과 (마이그레이션 옵트아웃)', () => {
      process.env.NODE_ENV = 'production';
      process.env.TOSS_WEBHOOK_ALLOW_UNSIGNED = 'true';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('개발/테스트 환경 + 미설정 → 경고 후 통과', () => {
      process.env.NODE_ENV = 'development';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('계층 ① 공유 시크릿', () => {
    test('유효한 x-webhook-secret 헤더 → next()', () => {
      process.env.TOSS_WEBHOOK_SECRET = 'shared-secret';
      req.get.mockReturnValue('shared-secret');

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('?secret= 쿼리 파라미터 → next()', () => {
      process.env.TOSS_WEBHOOK_SECRET = 'shared-secret';
      req.query.secret = 'shared-secret';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('잘못된 시크릿 → 401 거부 (다음 계층도 실패)', () => {
      process.env.TOSS_WEBHOOK_SECRET = 'shared-secret';
      req.get.mockReturnValue('wrong');

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('계층 ② IP 화이트리스트', () => {
    test('정확히 일치하는 IP → next()', () => {
      process.env.TOSS_WEBHOOK_IPS = '203.0.113.10';
      req.ip = '203.0.113.10';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('IPv4 CIDR 범위 포함 → next()', () => {
      process.env.TOSS_WEBHOOK_IPS = '203.0.113.0/24';
      req.ip = '203.0.113.10';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('::ffff: 프리픽스 정규화 (IPv4-mapped IPv6)', () => {
      process.env.TOSS_WEBHOOK_IPS = '203.0.113.10';
      req.ip = '::ffff:203.0.113.10';

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('화이트리스트 밖 IP → 401 거부', () => {
      process.env.TOSS_WEBHOOK_IPS = '198.51.100.5';
      req.ip = '203.0.113.10';

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('계층 ③ 레거시 Basic 인증', () => {
    test('TOSS_SECRET_KEY 기준 Basic 인증 → next()', () => {
      process.env.TOSS_SECRET_KEY = 'legacy-key';
      req.headers.authorization = 'Basic ' + Buffer.from('legacy-key:').toString('base64');

      tossWebhookAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('잘못된 Basic 인증 → 401 거부', () => {
      process.env.TOSS_SECRET_KEY = 'legacy-key';
      req.headers.authorization = 'Basic ' + Buffer.from('wrong:').toString('base64');

      tossWebhookAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

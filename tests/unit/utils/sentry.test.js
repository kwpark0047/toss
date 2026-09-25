jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  startSpan: jest.fn((opts, cb) => (typeof cb === 'function' ? cb() : undefined)),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

let sentry;
let SentryRef;
let loggerRef;
const loadFresh = () => {
  jest.resetModules();
  SentryRef = require('@sentry/node');
  loggerRef = require('../../../utils/logger');
  sentry = require('../../../utils/sentry');
  return sentry;
};

const setEnv = (key, value) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

beforeEach(() => {
  jest.clearAllMocks();
  loadFresh();
});

afterEach(() => {
  setEnv('NODE_ENV', ORIGINAL_NODE_ENV);
  setEnv('SENTRY_DSN', undefined);
  setEnv('SENTRY_TRACES_SAMPLE_RATE', undefined);
  setEnv('SENTRY_PROFILE_SAMPLE_RATE', undefined);
});

describe('sanitizeValue', () => {
  it('민감 키의 값을 재귀적으로 redaction한다', () => {
    const out = sentry.sanitizeValue({
      a: 1,
      token: 'abc',
      nested: { secret: 'x', keep: 'y' },
      list: [{ authoriZation: 'Bearer z', ok: 'o' }],
    });
    expect(out.a).toBe(1);
    expect(out.token).toBe('[REDACTED]');
    expect(out.nested.secret).toBe('[REDACTED]');
    expect(out.nested.keep).toBe('y');
    expect(out.list[0].authoriZation).toBe('[REDACTED]');
    expect(out.list[0].ok).toBe('o');
  });

  it('긴 문자열을 상한(2048자)으로 절단한다', () => {
    const out = sentry.sanitizeValue('x'.repeat(3000), 'message');
    expect(out.length).toBeLessThan(3000);
    expect(out.endsWith('chars truncated)')).toBe(true);
  });

  it('null/undefined/숫자는 그대로 통과한다', () => {
    expect(sentry.sanitizeValue(null)).toBeNull();
    expect(sentry.sanitizeValue(undefined)).toBeUndefined();
    expect(sentry.sanitizeValue(42)).toBe(42);
  });
});

describe('sanitizeEvent', () => {
  it('request의 headers/cookies/data 제거 및 query 파라미터 정화', () => {
    const event = {
      request: {
        method: 'GET',
        query_string: '?token=abc&page=1',
        headers: { authorization: 'Bearer x' },
        cookies: { sid: 'y' },
        data: { password: 'p' },
      },
      extra: { apiKey: 'k' },
    };
    const out = sentry.sanitizeEvent(event);
    expect(out.request.method).toBe('GET');
    expect(out.request.headers).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.data).toBeUndefined();
    expect(out.request.query_string).toBe('?page=1');
    expect(out.extra.apiKey).toBe('[REDACTED]');
  });
});

describe('shouldDropTransaction', () => {
  it('헬스/메트릭/실시간 폴링 트랜잭션을 드롭한다', () => {
    for (const name of ['GET /api/health', 'POST /api/metrics', 'GET /api/admin/realtime', 'GET /favicon.ico']) {
      expect(sentry.shouldDropTransaction({ transaction: name })).toBe(true);
    }
  });

  it('일반 API 트랜잭션은 유지한다', () => {
    for (const name of ['GET /api/orders', 'GET /api/health-history', 'POST /api/items']) {
      expect(sentry.shouldDropTransaction({ transaction: name })).toBe(false);
    }
  });
});

describe('makeTracesSampler', () => {
  it('명시적 베이스 레이트를 사용한다', () => {
    expect(sentry.makeTracesSampler(0.3)()).toBe(0.3);
  });

  it('범위를 0~1로 클램프한다', () => {
    expect(sentry.makeTracesSampler(2)()).toBe(1);
    expect(sentry.makeTracesSampler(-1)()).toBe(0);
  });

  it('env 없이 production이면 기본 0.1', () => {
    setEnv('NODE_ENV', 'production');
    expect(sentry.makeTracesSampler()()).toBe(0.1);
  });

  it('env 오버라이드가 최우선', () => {
    setEnv('SENTRY_TRACES_SAMPLE_RATE', '0.5');
    expect(sentry.makeTracesSampler()()).toBe(0.5);
  });

  it('env 없이 비-production이면 0', () => {
    setEnv('NODE_ENV', 'development');
    expect(sentry.makeTracesSampler()()).toBe(0);
  });
});

describe('initSentry', () => {
  it('테스트 환경에서는 비활성화한다', () => {
    setEnv('NODE_ENV', 'test');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    expect(sentry.initSentry()).toBeNull();
    expect(SentryRef.init).not.toHaveBeenCalled();
  });

  it('DSN 미설정 시 경고 로그 후 비활성화한다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', undefined);
    expect(sentry.initSentry()).toBeNull();
    expect(loggerRef.warn).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'));
  });

  it('DSN 있으면 tracesSampler/profilesSampleRate/sanitize 옵션으로 초기화한다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    expect(sentry.initSentry()).toBe(SentryRef);
    expect(SentryRef.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampler: expect.any(Function),
        beforeSend: expect.any(Function),
        beforeSendTransaction: expect.any(Function),
      })
    );
  });

  it('초기화 실패 시 예외를 삼키고 경고 로그를 남긴다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    SentryRef.init.mockImplementation(() => {
      throw new Error('init boom');
    });
    expect(sentry.initSentry()).toBeNull();
    expect(loggerRef.warn).toHaveBeenCalledWith(expect.stringContaining('초기화 실패'));
  });
});

describe('captureException', () => {
  it('비활성 상태에서는 전송하지 않는다', () => {
    sentry.captureException(new Error('boom'), { tags: { a: '1' } });
    expect(SentryRef.captureException).not.toHaveBeenCalled();
  });

  it('초기화 상태에서 tags/level/user 옵션을 전달한다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    sentry.initSentry();

    const err = new Error('boom');
    sentry.captureException(err, {
      tags: { status: '500', code: '9999' },
      level: 'error',
      user: { id: 'u1' },
    });
    expect(SentryRef.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: { status: '500', code: '9999' },
        level: 'error',
        user: { id: 'u1' },
      })
    );
  });

  it('레거시 형태 captureException(err, contextObj)를 extra로 수용한다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    sentry.initSentry();

    const err = new Error('boom');
    sentry.captureException(err, { orderId: 'ORD-1' });
    expect(SentryRef.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ extra: { orderId: 'ORD-1' } })
    );
  });
});

describe('trace / startSpan', () => {
  it('비활성 상태에서 trace는 fn 결과를 그대로 반환한다', () => {
    const result = sentry.trace('newsCron.collect', () => 42);
    expect(result).toBe(42);
    expect(SentryRef.startSpan).not.toHaveBeenCalled();
  });

  it('비활성 상태에서 startSpan은 null을 반환한다', () => {
    expect(sentry.startSpan('x')).toBeNull();
  });

  it('활성 상태에서 trace는 forceTransaction 트랜잭션으로 감싼다', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('SENTRY_DSN', 'https://dummy@sentry.example/1');
    sentry.initSentry();

    const result = sentry.trace('newsCron.collect', () => 7, { op: 'cron' });
    expect(result).toBe(7);
    expect(SentryRef.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'newsCron.collect', op: 'cron', forceTransaction: true }),
      expect.any(Function)
    );
  });
});
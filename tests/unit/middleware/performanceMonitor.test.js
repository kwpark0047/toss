jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../utils/sentry', () => ({
  startSpan: jest.fn(),
}));

const performanceMonitor = require('../../../middleware/performanceMonitor');
const sentry = require('../../../utils/sentry');
const logger = require('../../../utils/logger');

const createRes = () => {
  let finishCb = null;
  const res = {
    statusCode: 200,
    on: jest.fn((ev, cb) => {
      if (ev === 'finish') finishCb = cb;
      return res;
    }),
    emitFinish: () => finishCb && finishCb(),
  };
  return res;
};

describe('performanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('다음 미들웨어로 진행하고 디버그 로그를 남긴다', () => {
    const req = { method: 'GET', originalUrl: '/api/orders', baseUrl: '', route: null };
    const res = createRes();
    const next = jest.fn();

    performanceMonitor(req, res, next);
    res.emitFinish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[Performance] GET /api/orders')
    );
  });

  it('Sentry 비활성/스펙 미지원 환경(mock)에서는 스팬 조작 없이 안전하다', () => {
    sentry.startSpan.mockReturnValue(null);
    const req = { method: 'GET', originalUrl: '/api/health', baseUrl: '', route: null };
    const res = createRes();
    const next = jest.fn();

    performanceMonitor(req, res, next);
    res.emitFinish();

    expect(sentry.startSpan).toHaveBeenCalledWith('GET /api/health', { op: 'http.handler' });
    expect(logger.debug).toHaveBeenCalled();
  });

  it('활성 스팬에 라우트명/상태코드/사용자 태그를 부착하고 종료한다', () => {
    const span = {
      updateName: jest.fn(),
      setTag: jest.fn(),
      end: jest.fn(),
    };
    sentry.startSpan.mockReturnValue(span);

    const req = {
      method: 'POST',
      originalUrl: '/api/orders/ORD-1',
      baseUrl: '',
      route: { path: '/api/orders/:orderId' },
      user: { id: 'u9', role: 'admin' },
    };
    const res = createRes();
    res.statusCode = 500;
    const next = jest.fn();

    performanceMonitor(req, res, next);
    res.emitFinish();

    expect(span.updateName).toHaveBeenCalledWith('POST /api/orders/:orderId');
    expect(span.setTag).toHaveBeenCalledWith('http.status_code', 500);
    expect(span.setTag).toHaveBeenCalledWith('user_role', 'admin');
    expect(span.setTag).toHaveBeenCalledWith('user_id', 'u9');
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('라우트 없음(범용 미들웨어)은 originalUrl로 대체한다', () => {
    const span = { updateName: jest.fn(), setTag: jest.fn(), end: jest.fn() };
    sentry.startSpan.mockReturnValue(span);

    const req = { method: 'GET', originalUrl: '/api/health', baseUrl: '', route: null, user: null };
    const res = createRes();
    const next = jest.fn();
    performanceMonitor(req, res, next);
    res.emitFinish();

    expect(span.updateName).toHaveBeenCalledWith('GET /api/health');
    expect(span.setTag).toHaveBeenCalledWith('user_role', 'anonymous');
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});
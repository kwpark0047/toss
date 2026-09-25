jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../utils/sentry', () => ({
  captureException: jest.fn(),
}));

const { errorHandler, AppError } = require('../../../utils/errorHandler');
const sentry = require('../../../utils/sentry');

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('errorHandler — Sentry 단일 캡처 지점(status>=500)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('5xx 오류만 Sentry로 전송하고 컨텍스트 태그를 부착한다', () => {
    const err = new AppError('데이터베이스 연결 실패', 500, 5001);
    const req = { method: 'GET', originalUrl: '/api/admin/stats', ip: '1.2.3.4', user: { id: 'u1', role: 'admin' } };
    const res = createRes();

    errorHandler(err, req, res, jest.fn());

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: expect.objectContaining({ route: '/api/admin/stats', method: 'GET', code: '5001', status: '500' }),
        level: 'error',
        user: { id: 'u1' },
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('4xx(클라이언트/검증 오류)는 Sentry에 전송하지 않는다', () => {
    const err = new AppError('잘못된 요청 파라미터', 400, 1101);
    const req = { method: 'POST', originalUrl: '/api/orders', ip: '1.2.3.4', user: null };
    const res = createRes();

    errorHandler(err, req, res, jest.fn());

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('사용자 미보유 시 user 옵션을 undefined로 두어도 전송은 유지된다', () => {
    const err = new AppError('업스트림 타임아웃', 502, 5002);
    const req = { method: 'GET', originalUrl: '/api/items', ip: '1.2.3.4', user: null };
    const res = createRes();

    errorHandler(err, req, res, jest.fn());

    expect(sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ user: undefined })
    );
  });
});
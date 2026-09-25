jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../utils/sentry', () => ({
  captureException: jest.fn(),
}));

const alerting = require('../../../utils/alerting');
const sentry = require('../../../utils/sentry');

describe('alerting — 글로벌 핸들러 Sentry 배선', () => {
  let capturedHandlers;
  let processOnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandlers = {};
    processOnSpy = jest
      .spyOn(process, 'on')
      .mockImplementation((event, handler) => {
        capturedHandlers[event] = handler;
        return process;
      });
  });

  afterEach(() => {
    processOnSpy.mockRestore();
  });

  it('registerGlobalHandlers가 uncaughtException/unhandledRejection 핸들러를 등록한다', () => {
    alerting.registerGlobalHandlers();
    expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });

  it('uncaughtException을 fatal 레벨로 Sentry에 전송한다', () => {
    alerting.registerGlobalHandlers();
    const err = new Error('참사(boom)');
    capturedHandlers.uncaughtException(err);

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ tags: { source: 'uncaughtException' }, level: 'fatal' })
    );
  });

  it('unhandledRejection(Error)을 warning 레벨로 전송한다', () => {
    alerting.registerGlobalHandlers();
    const err = new Error('promise 실패');
    capturedHandlers.unhandledRejection(err);

    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { source: 'unhandledRejection' }, level: 'warning' })
    );
  });

  it('unhandledRejection의 reason이 문자열이면 Error로 감싼다', () => {
    alerting.registerGlobalHandlers();
    capturedHandlers.unhandledRejection('string으로 온 거부');

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [firstArg] = sentry.captureException.mock.calls[0];
    expect(firstArg).toBeInstanceOf(Error);
    expect(firstArg.message).toBe('string으로 온 거부');
    expect(sentry.captureException).toHaveBeenCalledWith(
      firstArg,
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('Sentry 전송은 실패해도 프로세스 핸들러 동작을 깨지 않는다', () => {
    alerting.registerGlobalHandlers();
    sentry.captureException.mockImplementation(() => {
      throw new Error('sentry down');
    });
    expect(() => capturedHandlers.uncaughtException(new Error('boom'))).not.toThrow();
  });
});
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../utils/alerting', () => ({
  send: jest.fn(),
}));

const { CircuitBreaker } = require('../../../utils/circuitBreaker');

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('성공한 호출의 타임아웃 타이머를 정리한다', async () => {
    const breaker = new CircuitBreaker('success', { timeoutMs: 10_000 });

    await expect(breaker.call(() => Promise.resolve('ok'))).resolves.toBe('ok');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('실패한 호출의 타임아웃 타이머를 정리한다', async () => {
    const breaker = new CircuitBreaker('failure', { timeoutMs: 10_000 });

    await expect(breaker.call(() => Promise.reject(new Error('실패')))).rejects.toThrow('실패');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('제한 시간을 넘긴 호출을 거부하고 타이머를 정리한다', async () => {
    const breaker = new CircuitBreaker('timeout', { timeoutMs: 100 });
    const result = breaker.call(() => new Promise(() => {}));
    const rejection = expect(result).rejects.toThrow('요청 타임아웃 (100ms)');

    await jest.advanceTimersByTimeAsync(100);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });
});

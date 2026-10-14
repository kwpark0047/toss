import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ post: vi.fn(), wake: vi.fn() }));
vi.mock('../api/client', () => ({ default: { post: mocks.post } }));
vi.mock('../api/wakeup', () => ({ wakeupServer: mocks.wake }));
import { authAPI } from '../api/auth';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.wake.mockResolvedValue();
  mocks.post.mockResolvedValue({ ok: true });
});
it.each([
  ['sendOtp', ['01000000000'], '/auth/send-otp'],
  ['verifyOtp', ['01000000000', '000000'], '/auth/verify-otp'],
  ['register', [{ phone: 'fixture' }], '/auth/register'],
  ['login', ['fixture', 'password'], '/auth/login'],
])('%s waits for readiness before sending a single write', async (method, args, url) => {
  let ready;
  mocks.wake.mockImplementation(
    () =>
      new Promise((resolve) => {
        ready = resolve;
      })
  );
  const pending = authAPI[method](...args);
  expect(mocks.post).not.toHaveBeenCalled();
  ready();
  await pending;
  expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(mocks.post.mock.calls[0][0]).toBe(url);
});
it('readiness failure sends no SMS request and provides a useful message', async () => {
  mocks.wake.mockRejectedValue(new Error('server unavailable'));
  await expect(authAPI.sendOtp('01000000000')).rejects.toThrow(/서버.*준비/);
  expect(mocks.post).not.toHaveBeenCalled();
});
it('an ambiguous POST timeout is not automatically retried', async () => {
  mocks.post.mockRejectedValue(
    Object.assign(new Error('timeout of 45000ms exceeded'), { code: 'ECONNABORTED' })
  );
  await expect(authAPI.sendOtp('01000000000')).rejects.toThrow(/처리 결과/);
  expect(mocks.post).toHaveBeenCalledTimes(1);
});

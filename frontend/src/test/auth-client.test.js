import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const api = vi.fn();
  api.interceptors = { request: { use: vi.fn() }, response: { use: vi.fn() } };
  return { api, post: vi.fn(), create: vi.fn(() => api) };
});
vi.mock('axios', () => ({ default: { create: mocks.create, post: mocks.post } }));
vi.mock('@/lib/csrf', () => ({ attachCsrfToken: vi.fn(), shouldRetryWithFreshToken: () => false }));
import '../api/client';

describe('login failures do not trigger session refresh or navigation', () => {
  const reject = mocks.api.interceptors.response.use.mock.calls[0][1];
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.api.mockClear();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    '/auth/login',
    '/auth/2fa/verify-login-otp',
    '/auth/free/mfa',
    '/auth/free/oauth/exchange',
  ])('%s preserves the original 401', async (url) => {
    localStorage.setItem('refreshToken', 'existing-refresh');
    fetch.mockRejectedValue(new Error('must not refresh an authentication request'));
    const error = {
      config: { url },
      response: { status: 401, data: { message: '인증 정보를 확인하세요.' } },
    };
    await expect(reject(error)).rejects.toBe(error);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('protected requests still refresh and retry once', async () => {
    localStorage.setItem('refreshToken', 'test-refresh');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { token: 'new-token', refreshToken: 'new-refresh' } }),
    });
    mocks.api.mockResolvedValueOnce({ success: true });
    const error = { config: { url: '/stores/my', headers: {} }, response: { status: 401 } };
    await expect(reject(error)).resolves.toEqual({ success: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh-token'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ refreshToken: 'test-refresh' }),
      })
    );
    expect(mocks.post).not.toHaveBeenCalled();
    expect(error.config.headers.Authorization).toBe('Bearer new-token');
  });
  it.each([
    ['/auth/free/oauth/kakao/start', { intent: 'link' }],
    ['/auth/free/oauth/google/start', JSON.stringify({ intent: 'reauth' })],
    ['/auth/free/email/request', { purpose: 'reauth' }],
    ['/auth/free/accounts', undefined],
  ])('refreshes expired session before retrying session-bound %s', async (url, data) => {
    localStorage.setItem('refreshToken', 'test-refresh');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { token: 'new-token', refreshToken: 'new-refresh' } }),
    });
    mocks.api.mockResolvedValueOnce({ success: true });
    const error = { config: { url, data, headers: {} }, response: { status: 401 } };
    await expect(reject(error)).resolves.toEqual({ success: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(error.config._retry).toBe(true);
  });
  it.each([
    ['/auth/free/oauth/kakao/start', { intent: 'login' }],
    ['/auth/free/email/request', { purpose: 'signup' }],
    ['/auth/free/email/verify', { id: 'fixture', code: 'fixture' }],
  ])('does not retry anonymous authentication or invalid OTP at %s', async (url, data) => {
    const error = { config: { url, data, headers: {} }, response: { status: 401 } };
    await expect(reject(error)).rejects.toBe(error);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});

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
  it.each(['/auth/login', '/auth/2fa/verify-login-otp'])(
    '%s preserves the original 401',
    async (url) => {
      const error = {
        config: { url },
        response: { status: 401, data: { message: '인증 정보를 확인하세요.' } },
      };
      await expect(reject(error)).rejects.toBe(error);
      expect(mocks.post).not.toHaveBeenCalled();
      expect(mocks.api).not.toHaveBeenCalled();
    }
  );
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
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshSession } from './authSession';
afterEach(() => vi.unstubAllGlobals());
describe('shared session renewal', () => {
  it('obtains cross-site CSRF proof before cookie session renewal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { csrfToken: 'proof' } }) })
      .mockImplementationOnce(async (_url, options) => {
        expect(options.headers['X-CSRF-Token']).toBe('proof');
        return { ok: true, json: async () => ({ data: { token: 'cookie-access' } }) };
      });
    vi.stubGlobal('fetch', fetchMock);
    await refreshSession('/api', true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/csrf-token');
  });
  it('does not submit cookie renewal when CSRF proof cannot be obtained', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(refreshSession('/api', true)).rejects.toThrow('CSRF');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not restore credentials after logout while renewal is pending', async () => {
    localStorage.clear();
    localStorage.setItem('refreshToken', 'before-logout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          localStorage.removeItem('refreshToken');
          return { data: { token: 'obsolete-access', refreshToken: 'obsolete-refresh' } };
        },
      })
    );
    await expect(refreshSession('/api', false)).rejects.toMatchObject({ status: 409 });
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('coalesces concurrent renewals and stores the rotated token once', async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { token: 'new-access', refreshToken: 'new-refresh' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => refreshSession('/api', false))
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.token === 'new-access')).toBe(true);
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });
  it('preserves existing credentials on a transient failure', async () => {
    localStorage.setItem('refreshToken', 'retry-later');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(refreshSession('/api', false)).rejects.toThrow('offline');
    expect(localStorage.getItem('refreshToken')).toBe('retry-later');
  });
});

import { it, expect, vi } from 'vitest';
import { logoutFlow } from '../lib/logoutFlow';
import { shouldWakeAndRetry } from '../lib/coldStart';
it('allows a single cold-start retry only for idempotent logout, not financial writes', () => {
  const error = { config: { method: 'post', url: '/auth/logout' }, response: { status: 502 } };
  expect(shouldWakeAndRetry(error)).toBe(true);
  expect(shouldWakeAndRetry({ ...error, config: { ...error.config, _coldRetry: true } })).toBe(
    false
  );
  expect(shouldWakeAndRetry({ ...error, config: { method: 'post', url: '/orders' } })).toBe(false);
  expect(shouldWakeAndRetry({ ...error, config: { method: 'post', url: '/auth/login' } })).toBe(
    false
  );
});
it('clears local identity after server revocation even if cache deletion fails', async () => {
  const revoke = vi.fn().mockResolvedValue(undefined),
    clearLocalSession = vi.fn();
  const result = await logoutFlow({
    revoke,
    clearLocalSession,
    clearCaches: vi.fn().mockRejectedValue(new Error('cache unavailable')),
  });
  expect(revoke).toHaveBeenCalledOnce();
  expect(clearLocalSession).toHaveBeenCalledOnce();
  expect(result.cacheCleared).toBe(false);
});
it('does not claim logout or clear local identity if server revocation fails', async () => {
  const clearLocalSession = vi.fn(),
    clearCaches = vi.fn();
  await expect(
    logoutFlow({
      revoke: vi.fn().mockRejectedValue(new Error('offline')),
      clearLocalSession,
      clearCaches,
    })
  ).rejects.toThrow('offline');
  expect(clearLocalSession).not.toHaveBeenCalled();
  expect(clearCaches).not.toHaveBeenCalled();
});

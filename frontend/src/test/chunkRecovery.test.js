import { describe, it, expect, vi } from 'vitest';
import { isChunkLoadError, recoverChunkLoad } from '../lib/chunkRecovery';

const fixture = () => {
  const stored = new Map();
  return {
    navigator: {
      onLine: true,
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn() }]) },
    },
    sessionStorage: {
      getItem: (key) => stored.get(key),
      setItem: (key, value) => stored.set(key, value),
    },
    caches: {
      keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'unrelated-cache']),
      delete: vi.fn(),
    },
    location: { href: 'https://example.com/admin/stores/3/menu?tab=all', replace: vi.fn() },
  };
};

describe('deployment chunk recovery', () => {
  it('recognizes module loading errors without treating render errors as stale chunks', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/old.js'))
    ).toBe(true);
    expect(isChunkLoadError(new Error('Grid is not defined'))).toBe(false);
  });
  it('refreshes once, preserves the route and only deletes app caches', async () => {
    const browser = fixture();
    expect(await recoverChunkLoad({ browser })).toBe(true);
    const url = new URL(browser.location.replace.mock.calls[0][0]);
    expect(url.pathname).toBe('/admin/stores/3/menu');
    expect(url.searchParams.get('tab')).toBe('all');
    expect(url.searchParams.has('_wm_cache_bust')).toBe(true);
    expect(browser.caches.delete.mock.calls).toEqual([['workbox-precache-v2']]);
    expect(await recoverChunkLoad({ browser })).toBe(false);
    expect(browser.location.replace).toHaveBeenCalledTimes(1);
    expect(await recoverChunkLoad({ browser, force: true })).toBe(true);
  });
  it('does not refresh offline or when a reload guard cannot be saved', async () => {
    const browser = fixture();
    browser.navigator.onLine = false;
    expect(await recoverChunkLoad({ browser })).toBe(false);
    browser.navigator.onLine = true;
    browser.sessionStorage.getItem = () => {
      throw new Error('unavailable');
    };
    expect(await recoverChunkLoad({ browser })).toBe(false);
    expect(browser.location.replace).not.toHaveBeenCalled();
  });
});

export function isChunkLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(
    String(error?.message || error || '')
  );
}

// One automatic recovery per tab prevents reload loops on persistent network failures.
export async function recoverChunkLoad({ force = false, browser = window } = {}) {
  if (browser.navigator.onLine === false) return false;
  try {
    if (!force && browser.sessionStorage.getItem('wm-chunk-recovered')) return false;
    browser.sessionStorage.setItem('wm-chunk-recovered', '1');
  } catch {
    if (!force) return false;
  }
  try {
    const registrations = (await browser.navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const names = (await browser.caches?.keys()) || [];
    await Promise.all(
      names
        .filter((name) => /workbox|wemarket|^wm-/i.test(name))
        .map((name) => browser.caches.delete(name))
    );
  } catch {
    // A fresh navigation can still recover when cache storage is unavailable.
  }
  const url = new URL(browser.location.href);
  url.searchParams.set('_wm_cache_bust', String(Date.now()));
  browser.location.replace(url.toString());
  return true;
}

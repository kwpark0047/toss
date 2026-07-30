const USER_CACHE_NAMES = new Set(['wemarket-api', 'wemarket-api-stale']);

export async function clearUserCaches() {
  if (!globalThis.caches) return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => USER_CACHE_NAMES.has(name))
      .map((name) => caches.delete(name))
  );
}

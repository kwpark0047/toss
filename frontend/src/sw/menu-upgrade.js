/* Imported before Workbox's message handler. Never navigate an existing client. */
const MENU_REVISION = '__MENU_REVISION__';

// Bridge older cache-first navigation workers without reloading their windows.
// Publish the new shell only after all of its menu/static dependencies are cached.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const legacy = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith('workbox-precache')) continue;
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname !== '/index.html') continue;
          const previous = await cache.match(request);
          const text = await previous?.text();
          if (text && !text.includes(`name="app-commit" content="${MENU_REVISION}"`)) legacy.push({ cache, request });
        }
      }
      if (!legacy.length) return;
      const response = await fetch('/index.html', { cache: 'no-store' });
      if (!response.ok) return;
      const html = await response.clone().text();
      if (!html.includes(`name="app-commit" content="${MENU_REVISION}"`)) return;
      const manifestResponse = await fetch('/menu-bootstrap.json', { cache: 'no-store' });
      const manifest = await manifestResponse.json();
      if (manifest.revision !== MENU_REVISION || !Array.isArray(manifest.assets)) return;
      const assets = await caches.open('wemarket-assets');
      await Promise.all(manifest.assets.map(async (path) => {
        if (!/^assets\/[\w./-]+$/.test(path) || path.includes('..')) throw new Error('Invalid asset');
        const url = new URL(`/${path}`, self.location.origin);
        const resource = await fetch(url.href, { cache: 'no-store' });
        if (!resource.ok || resource.headers.get('content-type')?.includes('text/html')) throw new Error('Unavailable asset');
        await assets.put(url.href, resource);
      }));
      for (const { cache, request } of legacy) await cache.put(request, response.clone());
    } catch { /* Leave the complete old offline shell intact on failure. */ }
  })());
});

const checkpointClient = (client) => new Promise((resolve) => {
  const channel = new MessageChannel();
  const finish = (ready) => { clearTimeout(timer); channel.port1.close(); resolve(ready); };
  const timer = setTimeout(() => finish(false), 1200);
  channel.port1.onmessage = (event) => finish(event.data?.ready === true);
  try { client.postMessage({ type: 'WM_MENU_CHECKPOINT' }, [channel.port2]); }
  catch { finish(false); }
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'WM_SAFE_SKIP_WAITING') return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ready = await Promise.all(clients.map(checkpointClient));
    // Older open windows cannot checkpoint: preserve them until they are closed.
    if (ready.every(Boolean)) await self.skipWaiting();
    else event.source?.postMessage({ type: 'WM_MENU_UPDATE_DEFERRED' });
  })());
});

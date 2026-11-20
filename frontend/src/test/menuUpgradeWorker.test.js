import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const source = readFileSync(path.resolve('src/sw/menu-upgrade.js'), 'utf8');
function fixture({ replies = [], failAsset = false } = {}) {
  const handlers = {};
  const writes = [];
  const shell = '<meta name="app-commit" content="__MENU_REVISION__">';
  const ports = class {
    constructor() {
      this.port1 = { close() {}, onmessage: null };
      this.port2 = { postMessage: (data) => this.port1.onmessage?.({ data }) };
    }
  };
  const oldKey = { url: 'https://example.com/index.html?__WB_REVISION__=old' };
  const self = {
    location: { origin: 'https://example.com' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    clients: { matchAll: async () => replies.map((ready) => ({
      postMessage(_data, [port]) { if (ready !== undefined) port.postMessage({ ready }); },
    })) },
    skipWaiting: vi.fn(async () => {}),
  };
  vm.runInNewContext(source, {
    self, URL, MessageChannel: ports, setTimeout, clearTimeout,
    fetch: async (input) => {
      const url = String(input);
      if (url === '/index.html') return { ok: true, clone() { return this; }, text: async () => shell };
      if (url === '/menu-bootstrap.json') return { json: async () => ({ revision: '__MENU_REVISION__', assets: ['assets/root.js', 'assets/menu.js'] }) };
      return { ok: !failAsset, headers: { get: () => 'application/javascript' } };
    },
    caches: {
      keys: async () => ['workbox-precache-v2-test', 'unrelated-cache'],
      open: async (name) => ({ keys: async () => [oldKey], match: async () => ({ text: async () => '<meta name="app-commit" content="old">' }), put: async (key) => writes.push(`${name}:${typeof key === 'string' ? key : key.url}`) }),
    },
  });
  let work;
  const deferred = vi.fn();
  return { writes, self, deferred,
    install: () => { handlers.install({ waitUntil: (value) => { work = value; } }); return work; },
    activate: () => { handlers.message({ data: { type: 'WM_SAFE_SKIP_WAITING' }, source: { postMessage: deferred }, waitUntil: (value) => { work = value; } }); return work; },
  };
}
afterEach(() => vi.useRealTimers());
describe('legacy cached shell handoff', () => {
  it('warms the complete menu assets before publishing current HTML under legacy cache keys', async () => {
    const test = fixture();
    await test.install();
    expect(test.writes).toHaveLength(3);
    expect(test.writes[2]).toContain('workbox-precache-v2-test:');
    expect(test.self.skipWaiting).not.toHaveBeenCalled();
  });
  it('leaves old offline HTML intact when a critical asset is unavailable', async () => {
    const test = fixture({ failAsset: true });
    await test.install();
    expect(test.writes).toEqual([]);
  });
  it('activates only when every open client can safely checkpoint', async () => {
    const test = fixture({ replies: [true, true] });
    await test.activate();
    expect(test.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it('preserves a busy checkout and a legacy client that cannot acknowledge', async () => {
    vi.useFakeTimers();
    const test = fixture({ replies: [true, false, undefined] });
    const work = test.activate();
    await vi.advanceTimersByTimeAsync(1300);
    await work;
    expect(test.self.skipWaiting).not.toHaveBeenCalled();
    expect(test.deferred).toHaveBeenCalledWith({ type: 'WM_MENU_UPDATE_DEFERRED' });
  });
});

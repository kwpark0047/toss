// Warm the browser cache with fixtures, then simulate a slow backend. No production writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
async function main() {
  let base = process.argv[2], server;
  if (!base) {
    const root = path.resolve(__dirname, '../frontend/dist');
    server = http.createServer((req, res) => {
      let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    await context.routeWebSocket('**', socket => socket.close());
    let slow = false, release, healthFinished = false;
    const pending = new Promise(resolve => { release = resolve; });
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.pathname.includes('/socket.io')) return route.abort();
      if (!u.pathname.startsWith('/api/')) return route.continue();
      const isQr = u.pathname.startsWith('/api/tables/qr/');
      const fresh = slow;
      if (slow && !isQr) await pending;
      let data = [];
      if (u.pathname === '/api/health') healthFinished = fresh;
      else if (isQr) data = { store_id: 3, table_number: '1' };
      else if (u.pathname === '/api/stores/3') data = { id: 3, name: '속도 검증 매장' };
      else if (u.pathname === '/api/categories/store/3') data = [{ id: 1, name: '음료' }];
      else if (u.pathname === '/api/products/store/3') data = [{ id: 1, name: fresh ? '갱신된 메뉴' : '저장된 메뉴', price: fresh ? 4500 : 4000, category_id: 1 }];
      await route.fulfill({ json: { success: true, data } }).catch(() => {});
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/menu/3?table=1');
    await page.getByText('저장된 메뉴', { exact: true }).first().waitFor();
    await page.waitForFunction(async () => {
      const db = await new Promise(resolve => { const req = indexedDB.open('wemarket-menu-cache', 1); req.onsuccess = () => resolve(req.result); });
      const values = await Promise.all(['profile', 'categories', 'menu'].map(type => new Promise(resolve => { const req = db.transaction('menu').objectStore('menu').get('3:' + type); req.onsuccess = () => resolve(req.result); })));
      db.close(); return values.every(Boolean);
    });
    slow = true;
    const started = Date.now();
    await page.goto(base + '/qr/speed-fixture', { waitUntil: 'domcontentloaded' });
    await page.getByText('저장된 메뉴', { exact: true }).first().waitFor();
    const cachedMenuMs = Date.now() - started;
    assert.equal(healthFinished, false, 'QR lookup and cached menu must not wait for health');
    await page.getByRole('status').filter({ hasText: '최신 가격과 품절 정보를 확인 중' }).waitFor();
    release();
    await page.getByText('갱신된 메뉴', { exact: true }).first().waitFor();
    await page.getByRole('status').filter({ hasText: '최신 가격과 품절 정보를 확인 중' }).waitFor({ state: 'hidden' });
    assert.equal(errors.length, 0, errors.join(';'));
    console.log(JSON.stringify({ passed: true, fixtureData: true, cachedMenuMs, healthGateRemoved: true, backgroundRefresh: true, errors }));
    await context.close();
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

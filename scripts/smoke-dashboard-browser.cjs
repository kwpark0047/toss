// UI-only fixtures: all API/socket traffic is intercepted; no production data or writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

async function main() {
  let base = process.argv[2];
  let server;
  if (!base) {
    const root = path.resolve(__dirname, '../frontend/dist');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
    server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        if (path.extname(pathname)) { res.writeHead(404).end(); return; }
        file = path.join(root, 'index.html');
      }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [name, width, height, theme] of [
      ['desktop-dark', 1440, 1000, 'obsidian'],
      ['desktop-light', 1440, 1000, 'arctic'],
      ['mobile', 390, 844, 'arctic'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      const payload = Buffer.from(JSON.stringify({ id: 3, name: '강남3', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      await context.addInitScript(({ token, theme }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('adm-theme', theme);
      }, { token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, theme });
      await context.routeWebSocket('**', socket => socket.close());
      let failStats = false;
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/socket.io')) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let data = [];
        const store = { id: 3, name: '강남3', business_type: 'RESTAURANT', user_id: 3 };
        if (url.pathname === '/api/health') return route.fulfill({ json: { status: 'ok', db: 'connected' } });
        if (url.pathname === '/api/stores/my') data = [store];
        else if (url.pathname === '/api/stores/3') data = store;
        else if (/\/orders\/store\/3\/stats$/.test(url.pathname)) {
          if (failStats) return route.fulfill({ status: 500, json: { message: 'Test unavailable' } });
          data = { total_sales: 768000, total_orders: 24, by_status: { pending: 2, preparing: 3, completed: 19 } };
        } else if (url.pathname === '/api/orders/store/3') data = [
          { id: 91, order_number: 'WM-0091', status: 'pending', total_amount: 32000, created_at: new Date().toISOString(), table_name: '3' },
          { id: 90, order_number: 'WM-0090', status: 'preparing', total_amount: 48000, created_at: new Date().toISOString(), table_name: '1' },
        ];
        else if (url.pathname.includes('/detailed-stats')) data = { hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour > 10 && hour < 20 ? hour % 6 + 1 : 0, amount: 0 })) };
        else if (url.pathname.includes('/comparison')) data = { growth: { sales: 8.2, orders: 4.1 } };
        else if (url.pathname.includes('/sales')) data = { summary: {}, data: Array.from({ length: 7 }, (_, i) => ({ label: `10-${String(i + 1).padStart(2, '0')}`, sales: [420000, 480000, 380000, 640000, 550000, 690000, 768000][i] })) };
        else if (url.pathname.includes('/products')) data = [{ id: 1, name: '대표 메뉴', quantity: 18 }, { id: 2, name: '세트 메뉴', quantity: 12 }];
        else if (url.pathname.includes('/unread-count')) data = { total: 0, urgent: 0, by_type: {} };
        return route.fulfill({ json: { success: true, data } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('/admin', base).href, { waitUntil: 'domcontentloaded' });
      try { await page.locator('.dashboard-metrics > div').first().waitFor(); }
      catch (error) { console.error(JSON.stringify({ url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 1800) })); throw error; }
      await page.getByText('API · DB 정상', { exact: true }).waitFor();
      await page.locator('.recharts-area-curve').first().waitFor();
      await page.getByRole('region', { name: '주문 상태 분포' }).waitFor();
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        sidebarDisplay: getComputedStyle(document.querySelector('[data-testid="admin-sidebar"]')).display,
        metricTop: document.querySelector('.dashboard-metrics').getBoundingClientRect().top,
        mainLeft: document.querySelector('.admin-content').getBoundingClientRect().left,
      }));
      assert.ok(geometry.documentWidth <= width + 1, 'no horizontal page overflow');
      assert.ok(geometry.metricTop < 500, 'key metrics must be visible without a blank first screen');
      assert.equal(geometry.sidebarDisplay === 'none', width < 1024, 'responsive sidebar');
      if (width >= 1024) assert.ok(geometry.mainLeft >= 200, 'main area sits beside sidebar');
      if (width < 1024) {
        await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.equal(await page.getByRole('button', { name: '전체 메뉴 열기' }).evaluate(element => element === document.activeElement), true);
      }
      await page.screenshot({ path: path.resolve('reports', `dashboard-${name}.png`), fullPage: false });
      failStats = true;
      await page.getByRole('button', { name: '새로고침', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '매출 또는 주문 정보를 불러오지 못했습니다' }).waitFor();
      assert.equal(errors.length, 0, errors.join('; '));
      results.push({ name, fixtureData: true, ...geometry, pageErrors: errors, failureState: 'visible' });
      await context.close();
    }
    fs.writeFileSync('reports/dashboard-browser-validation.json', JSON.stringify({ passed: true, base, results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }, null, 2));
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

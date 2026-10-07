// Browser fixtures intercept every API request. No operating data or credentials are used.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
async function main() {
  const root = path.resolve(__dirname, '../frontend/dist');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file)) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      const payload = Buffer.from(JSON.stringify({ id: 3, name: '검증', role: 'user', type: 'access', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      await context.addInitScript(token => { localStorage.setItem('token', token); localStorage.setItem('adm-theme', 'arctic'); }, 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.fixture');
      await context.routeWebSocket('**', socket => socket.close());
      let imports = 0;
      const providerRow = { provider: 'pos', label: 'POS', fields: ['api_key'], configured: false, registered: false, adapter: false, enabled: true, masked: {} };
      const weatherRow = { provider: 'weather', label: '기상청', fields: ['api_key'], configured: false, registered: false, adapter: true, enabled: true, masked: {} };
      const source = { id: '11111111-1111-4111-8111-111111111111', name: 'POS 검증', channel: 'pos', provider: '검증 업체', method: 'csv', enabled: true };
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/socket.io')) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const store = { id: 3, name: '검증 매장', user_id: 3 };
        let data = [];
        if (url.pathname.startsWith('/api/provider-credentials/')) {
          const row = url.pathname.includes('/global') ? weatherRow : providerRow;
          if (route.request().method() === 'PUT') { assert.ok(!JSON.stringify(route.request().postDataJSON()).includes('store_id')); row.configured = true; row.registered = true; row.updated_at = new Date().toISOString(); row.masked = { api_key: '••••1234' }; data = { saved: true }; }
          else data = [row];
          return route.fulfill({ json: { success: true, data } });
        }
        if (url.pathname === '/api/stores/my') data = [store];
        else if (url.pathname === '/api/stores/3') data = store;
        else if (url.pathname.endsWith('/overview')) data = { connections: [source], channels: [{ channel: 'qr', orders: 1, revenue: 5000 }], total_orders: 1, total_revenue: 5000, crm_customers: 1, notes: [] };
        else if (url.pathname.endsWith('/preview')) data = { count: 1, by_kind: { order: 1 }, samples: [{ event_id: 'delivery-1', record_id: 'order-1', kind: 'order', version: 1, amount: 3000, status: 'paid' }], warnings: ['분석용 기록입니다.'] };
        else if (url.pathname.endsWith('/import')) { imports++; data = { accepted: 1, duplicates: 0, received: 1 }; }
        return route.fulfill({ json: { success: true, data } });
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/admin/stores/3/integrations`);
      await page.getByRole('heading', { name: '데이터 통합 센터', exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'POS API 키', exact: true }).fill('fixture-pipeline-secret-key-1234');
      await page.locator('article').filter({ has: page.getByRole('heading', { name: 'POS', exact: true }) }).getByRole('button', { name: '저장', exact: true }).click();
      await page.getByText('현재 값: ••••1234', { exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'POS API 키', exact: true }).inputValue(), '');
      assert.ok(!(await page.locator('body').innerText()).includes('fixture-pipeline-secret-key-1234'));
      await page.getByRole('combobox', { name: '수집 연결', exact: true }).selectOption(source.id);
      await page.getByRole('textbox', { name: 'CSV 내용', exact: true }).fill('event_id,record_id,kind,version,occurred_at,amount,status\ndelivery-1,order-1,order,1,2026-10-07T12:00:00+09:00,3000,paid');
      assert.equal(await page.getByRole('button', { name: '확인한 데이터 수집' }).isEnabled(), false);
      await page.getByRole('button', { name: '가져오기 미리보기' }).click();
      await page.getByRole('heading', { name: '미리보기: 1건' }).waitFor();
      await page.getByRole('button', { name: '확인한 데이터 수집' }).click();
      await page.getByText('1건 수집 · 중복 0건 제외', { exact: true }).waitFor();
      assert.equal(imports, 1);
      await page.getByRole('button', { name: '성장 플랫폼 기획', exact: true }).click();
      await page.getByRole('heading', { name: '매장성장 플랫폼 추가기능 기획' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      const adminPayload = Buffer.from(JSON.stringify({ id: 1, name: '최고관리자 검증', role: 'super_admin', type: 'access', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      await context.addInitScript(token => localStorage.setItem('token', token), 'eyJhbGciOiJIUzI1NiJ9.' + adminPayload + '.fixture');
      await page.goto(`http://127.0.0.1:${server.address().port}/admin/provider-settings`);
      await page.getByRole('heading', { name: '전체 매장 공통 API 설정', exact: true }).waitFor();
      await page.getByRole('textbox', { name: '기상청 API 키', exact: true }).fill('fixture-weather-key-1234');
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await page.getByText('현재 값: ••••1234', { exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: '기상청 API 키', exact: true }).inputValue(), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, viewports: [1440, 390], previewRequired: true, imports: true, growthRoadmap: true, apiFixtureOnly: true }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

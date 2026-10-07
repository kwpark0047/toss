// All API traffic is intercepted. This test does not use operating accounts.
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
      const action = { id: '11111111-1111-4111-8111-111111111111', kind: 'menu_feature', status: 'proposed', created_at: new Date().toISOString(), payload: { title: '추천 메뉴를 QR 첫 화면에 보여주세요', reason: '실제 주문 데이터 기준 무할인 노출입니다.', product_id: 1, product_name: '검증 메뉴' } };
      let execution = 0;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/socket.io')) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const store = { id: 3, name: '검증 매장', user_id: 3 };
        let data = [];
        if (url.pathname.endsWith('/briefing')) data = { store, as_of: new Date().toISOString(), can_execute: true, clock: { hour: 16 }, current: { orders: 5, revenue: 50000 }, historical: { days: 4, revenue: 100000 }, review: { count: 2 }, insights: [{ key: 'drop', title: '오늘 매출을 확인하세요', detail: '같은 시간대의 비교 자료입니다.', severity: 'warning' }], actions: [action], coverage: {}, notes: ['자체 주문 기준'] };
        else if (url.pathname.endsWith('/approve')) { assert.equal(action.status, 'proposed'); action.status = 'approved'; data = action; }
        else if (url.pathname.endsWith('/execute')) { assert.equal(action.status, 'approved'); execution++; action.status = 'running'; action.started_at = new Date().toISOString(); action.ends_at = new Date(Date.now() + 7 * 86400000).toISOString(); data = action; }
        else if (url.pathname.endsWith('/stop')) { action.status = 'stopped'; data = action; }
        else if (url.pathname.endsWith('/evaluation')) data = { verdict: 'pending', message: '7일 실행 후 평가합니다.' };
        else if (url.pathname.endsWith('/chat')) data = { reply: '사장님, 현재 매장의 확인된 주문을 기준으로 추천합니다.', engine: 'verified_rules', as_of: new Date().toISOString() };
        else if (url.pathname.endsWith('/featured')) data = action.status === 'running' ? [{ id: 1, name: '검증 메뉴', price: 10000 }] : [];
        else if (url.pathname === '/api/stores/my') data = [store];
        else if (url.pathname === '/api/stores/3') data = store;
        else if (url.pathname === '/api/stores/3/public-profile' || url.pathname === '/api/stores/3/profile') data = { ...store, store_name: store.name };
        else if (url.pathname === '/api/categories/store/3') data = [{ id: 1, name: '전체' }];
        else if (url.pathname === '/api/products/store/3') data = [{ id: 1, name: '검증 메뉴', price: 10000, category_id: 1, is_active: true }];
        return route.fulfill({ json: { success: true, data } });
      });
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.goto(`http://127.0.0.1:${server.address().port}/admin/stores/3/ai-manager`);
      await page.getByRole('heading', { name: 'AI 매장 매니저', exact: true }).waitFor();
      await page.getByRole('button', { name: '제안 승인', exact: true }).click();
      await page.getByRole('button', { name: '미리보기 확인 후 적용', exact: true }).click();
      await page.getByRole('button', { name: '노출 중단', exact: true }).waitFor(); assert.equal(execution, 1);
      await page.getByRole('button', { name: '효과 확인', exact: true }).click(); await page.getByText('7일 실행 후 평가합니다.', { exact: true }).waitFor();
      await page.getByRole('textbox', { name: '매장 분석 질문' }).fill('메뉴 추천'); await page.getByRole('button', { name: '질문하기', exact: true }).click();
      await page.getByText('사장님, 현재 매장의 확인된 주문을 기준으로 추천합니다.').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.goto(`http://127.0.0.1:${server.address().port}/menu/3?table=1`);
      await page.getByRole('heading', { name: '지금 추천하는 메뉴', exact: true }).waitFor({ timeout: 15000 });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(JSON.stringify({ width, approvedExecution: true, evaluation: true, chat: true, qrRecommendation: true, overflow: false, errors: [] }));
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

// Browser fixtures only: no real credentials, production writes or QR rotation.
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
      const pathname = new URL(req.url, 'http://localhost').pathname;
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
      res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      const payload = Buffer.from(JSON.stringify({ id: 3, name: '검증', role: 'user', type: 'access', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      await context.addInitScript(token => localStorage.setItem('token', token), 'eyJhbGciOiJIUzI1NiJ9.' + payload + '.fixture');
      await context.routeWebSocket('**', socket => socket.close());
      const table = { id: 1, store_id: 3, table_number: '창가 & 1', capacity: 4, qr_code: 'fixture-token', status: 'available' };
      let externalQr = 0, invalid = false;
      await context.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.hostname.includes('qrserver')) { externalQr++; return route.abort(); }
        if (u.pathname.includes('/socket.io')) return route.abort();
        if (!u.pathname.startsWith('/api/')) return route.continue();
        const store = { id: 3, name: '검증 매장', user_id: 3 };
        let data = [];
        if (u.pathname === '/api/stores/my') data = [store];
        else if (u.pathname === '/api/stores/3') data = store;
        else if (u.pathname === '/api/products/store/3') data = [{ id: 1, name: '검증 아메리카노', price: 4000, category_id: 1, is_sold_out: false }];
        else if (u.pathname === '/api/categories/store/3') data = [{ id: 1, name: '음료' }];
        else if (u.pathname === '/api/tables/store/3') data = [table, { ...table, id: 2, table_number: '2번', qr_code: null }];
        else if (u.pathname.startsWith('/api/tables/qr/')) {
          if (invalid) return route.fulfill({ status: 404, json: { message: 'invalid fixture' } });
          data = table;
        }
        return route.fulfill({ json: { success: true, data } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/admin/stores/3/tables');
      await page.getByRole('heading', { name: '테이블 · QR 관리' }).waitFor();
      await page.getByRole('button', { name: 'QR', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('img', { name: '창가 & 1 주문 QR 코드' }).waitFor();
      const image = dialog.getByRole('img');
      await image.evaluate(img => img.decode());
      assert.ok((await image.getAttribute('src')).startsWith('data:image/png;base64,'));
      assert.equal(await dialog.getByRole('link').getAttribute('href'), 'https://wemarket-saas.vercel.app/qr/fixture-token');
      assert.ok(await image.evaluate(img => img.naturalWidth >= 600));
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'PNG', exact: true }).click();
      const png = await download, bytes = fs.readFileSync(await png.path());
      assert.equal(bytes.readUInt32BE(16), 900); assert.equal(bytes.readUInt32BE(20), 1300);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'QR', exact: true }).nth(1).click();
      assert.equal(await dialog.getByRole('link').getAttribute('href'), 'https://wemarket-saas.vercel.app/menu/3?table=2%EB%B2%88');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      const pdfEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'PDF', exact: true }).click();
      const pdf = await pdfEvent; assert.equal(fs.readFileSync(await pdf.path()).subarray(0, 4).toString(), '%PDF');
      await page.goto(base + '/qr/fixture-token'); await page.waitForURL('**/menu/3?table=*');
      await page.getByText('검증 아메리카노', { exact: true }).first().waitFor();
      assert.ok(await page.locator('header').first().isVisible());
      assert.equal(new URL(page.url()).searchParams.get('table'), '창가 & 1');
      invalid = true; await page.goto(base + '/qr/invalid-token');
      await page.getByRole('heading', { name: '메뉴판을 불러올 수 없습니다' }).waitFor();
      invalid = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      await page.waitForURL('**/menu/3?table=*');
      await page.getByText('검증 아메리카노', { exact: true }).first().waitFor();
      await page.goto(base + '/menu/3?table=2');
      await page.getByText('검증 아메리카노', { exact: true }).first().waitFor();
      assert.equal(externalQr, 0); assert.equal(errors.length, 0, errors.join(';'));
      results.push({ width, fixtureData: true, png: true, pdf: true, retry: true, externalQrRequests: externalQr, errors });
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, results }));
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

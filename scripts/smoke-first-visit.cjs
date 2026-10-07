// Real service worker lifecycle, local production build, no production API writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

async function main() {
  const root = path.resolve(__dirname, '../frontend/dist');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, data: [] }));
    }
    let file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = [], documents = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/auth`);
    await page.locator('input').first().waitFor();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), { timeout: 20000 });
    // A controllerchange reload is queued on the next event loop turn.
    await page.waitForTimeout(500);
    assert.equal(documents.length, 1, 'First SW activation must not reload the document');
    const cachedScripts = await page.evaluate(async () => {
      const names = await caches.keys();
      const requests = (await Promise.all(names.map(async name => (await caches.open(name)).keys()))).flat();
      return requests.map(request => new URL(request.url).pathname).filter(url => url.endsWith('.js'));
    });
    assert(!cachedScripts.some(url => /AIStoreManager|MenuManager|MenuBuilder|jspdf|xlsx/.test(url)), 'First visit must not fetch unvisited admin/export modules');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, firstVisitDocuments: documents.length, cachedScripts, errors }));
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

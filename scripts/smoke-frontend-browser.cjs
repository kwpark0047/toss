const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  let server;
  let browser;
  let base = process.argv[2];
  const results = [];
  try {
    if (!base) {
      const root = path.resolve(__dirname, '../frontend/dist');
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
    browser = await chromium.launch({ headless: true, timeout: 20000 });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    for (const route of ['/', '/auth', '/pricing']) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      try {
        await page.waitForFunction(() => document.body.innerText.trim().length > 100, null, { timeout: 15000 });
      } catch {
        throw new Error(`${route}: ${errors.join('; ') || 'page remained blank'}`);
      }
      const body = await page.locator('body').innerText();
      if (errors.length || /useLocation\(\).*Router|Something went wrong/i.test(body)) {
        throw new Error(`${route}: ${errors.join('; ') || 'error screen rendered'}`);
      }
      results.push({ route, rendered: true, characters: body.length, pageErrors: errors });
      await page.close();
    }
    console.log(JSON.stringify({ base, passed: true, results }, null, 2));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

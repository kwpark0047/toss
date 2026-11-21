'use strict';
// Opt-in local verification. Never loads .env or an existing database/backup.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const bin = process.env.CART_PWA_PG_BIN;
if (!bin || !fs.existsSync(path.join(bin, 'initdb.exe')))
  throw Error('Set CART_PWA_PG_BIN to trusted PostgreSQL binaries');
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
const dir = fs.mkdtempSync(path.join(root, '.tmp', 'cart-pwa-isolated-'));
const data = path.join(dir, 'pgdata');
const exe = (name) => path.join(bin, `${name}.exe`);
const ports = { db: 55449, api: 3109, web: 5189 };
const origin = `http://127.0.0.1:${ports.web}`;
const url = `postgresql://postgres@127.0.0.1:${ports.db}/wemarket_test_cart_pwa`;
assert.equal(new URL(url).hostname, '127.0.0.1');
const env = {};
for (const key of [
  'PATH',
  'Path',
  'SYSTEMROOT',
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'COMSPEC',
  'PATHEXT',
]) {
  if (process.env[key]) env[key] = process.env[key];
}
Object.assign(env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  DIRECT_URL: url,
  REPLICA_URL: url,
  JWT_SECRET: 'isolated-cart-pwa-fixture-not-a-production-key',
  JWT_REFRESH_SECRET: 'isolated-cart-pwa-refresh-fixture',
  PORT: String(ports.api),
  CORS_ORIGIN: origin,
  FRONTEND_URL: origin,
  BACKEND_URL: `http://127.0.0.1:${ports.api}`,
  SMS_ENV: 'dev',
  DOTENV_CONFIG_PATH: path.join(dir, 'absent.env'),
  GEMINI_LIVE_ENABLED: 'false',
  WEBHOOK_RETRY_ENABLED: 'false',
});
const children = [];
let pgStarted = false,
  browser,
  web,
  activeBuild;
const checks = [];
const network = { blockedBrowser: 0, apiPaths: new Set() };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function run(command, args, opts = {}) {
  // pg_ctl's server child must not inherit a pipe that keeps spawnSync waiting.
  const log = fs.openSync(path.join(dir, 'setup.log'), 'a');
  const r = spawnSync(command, args, {
    cwd: root,
    env,
    windowsHide: true,
    timeout: 180000,
    stdio: ['ignore', log, log],
    ...opts,
  });
  fs.closeSync(log);
  if (r.status !== 0)
    throw Error(`Command failed: ${path.basename(command)} ${args[0]} (see local setup.log)`);
}
function start(command, args) {
  const log = fs.openSync(path.join(dir, 'backend.log'), 'a');
  const p = spawn(command, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  fs.closeSync(log);
  children.push(p);
  return p;
}
async function waitFor(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {}
    await pause(250);
  }
  throw Error(`Timed out: ${label}`);
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function seed() {
  const { PrismaClient } = require('../prisma/app/generated/prisma');
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const owner = await p.users.create({
      data: {
        name: 'Isolated fixture',
        password: 'not-login-enabled',
        role: 'store_owner',
        password_login_enabled: false,
      },
    });
    const store = await p.stores.create({
      data: { user_id: owner.id, name: 'Isolated Cart Cafe', is_active: true },
    });
    assert.equal(store.id, 1);
    const cat = await p.categories.create({ data: { store_id: store.id, name: 'Local menu' } });
    await p.products.create({
      data: {
        store_id: store.id,
        category_id: cat.id,
        name: 'Isolated Coffee',
        price: 4500,
        options: '[]',
      },
    });
  } finally {
    await p.$disconnect();
  }
}
async function build(revision, name) {
  run(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build'], {
    cwd: path.join(root, 'frontend'),
    env: {
      ...env,
      NODE_ENV: 'production',
      APP_COMMIT_SHA: revision,
      VITE_API_URL: `http://127.0.0.1:${ports.api}/api`,
      VITE_SOCKET_URL: `http://127.0.0.1:${ports.api}`,
    },
  });
  const target = path.join(dir, name);
  fs.cpSync(path.join(root, 'frontend/dist'), target, { recursive: true });
  return target;
}
async function staticServer() {
  web = http.createServer(async (req, res) => {
    const u = new URL(req.url, origin);
    if (u.pathname.startsWith('/api/')) {
      const proxy = http.request(
        {
          hostname: '127.0.0.1',
          port: ports.api,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        }
      );
      proxy.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(proxy);
      return;
    }
    let relative = decodeURIComponent(u.pathname).replace(/^\//, '');
    if (relative.includes('..')) {
      res.writeHead(400);
      res.end();
      return;
    }
    let file = path.join(activeBuild, relative);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // Retain old assets for already-open windows, as a production deployment should.
      const old = path.join(dir, 'build-a', relative);
      file =
        relative.startsWith('assets/') && fs.existsSync(old)
          ? old
          : path.join(activeBuild, 'index.html');
    }
    const mime = {
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    };
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => web.listen(ports.web, '127.0.0.1', r));
}
async function revision(page) {
  return page.locator('meta[name="app-commit"]').getAttribute('content');
}
async function entries(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('wm-menu-cart-v1:1:A1') || '{"entries":[]}').entries.filter(
      (x) => !x.deleted
    )
  );
}
async function quantity(page) {
  return (await entries(page)).reduce((sum, item) => sum + item.quantity, 0);
}
async function main() {
  // Pin application source independently of the documentation/test branch.
  execFileSync(
    'git',
    ['diff', '--quiet', '014c3a938e943efecc152494bf279e3d8a3f3589', '--', 'frontend'],
    { cwd: root }
  );
  execFileSync(
    'git',
    [
      'diff',
      '--quiet',
      '975ab5d863652b54189079c000c32d513f78b23f',
      '--',
      'app.mts',
      'socket',
      'services',
      'routes',
      'repositories',
      'src',
      'prisma',
      'config',
    ],
    { cwd: root }
  );
  // Reserve all ports before initialization. Existing listeners are never reused.
  for (const port of Object.values(ports)) {
    const s = http.createServer();
    await new Promise((resolve, reject) =>
      s.once('error', reject).listen(port, '127.0.0.1', resolve)
    );
    await new Promise((r) => s.close(r));
  }
  run(exe('initdb'), [
    '-D',
    data,
    '--auth=trust',
    '--username=postgres',
    '--encoding=UTF8',
    '--locale=C',
  ]);
  run(exe('pg_ctl'), [
    '-D',
    data,
    '-l',
    path.join(dir, 'pg.log'),
    '-o',
    `-h 127.0.0.1 -p ${ports.db}`,
    '-w',
    'start',
  ]);
  pgStarted = true;
  const c = new Client({
    host: '127.0.0.1',
    port: ports.db,
    user: 'postgres',
    database: 'postgres',
  });
  await c.connect();
  await c.query('CREATE DATABASE wemarket_test_cart_pwa');
  await c.end();
  run(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate']);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
  await seed();
  // Backend refuses non-loopback sockets, independently of browser request interception.
  const guard = path.join(dir, 'loopback-only.cjs');
  fs.writeFileSync(
    guard,
    `const net=require('node:net');const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const a=Array.isArray(args[0])?args[0]:args;const o=a[0];const host=typeof o==='object'?o.host:typeof a[1]==='string'?a[1]:'localhost';if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('ISOLATED_EXTERNAL_NETWORK_BLOCKED');return original.apply(this,args);};`
  );
  start(process.execPath, ['--require', guard, '--import', 'tsx', 'scripts/cart-pwa-backend.mts']);
  await waitFor(
    async () => (await fetch(`http://127.0.0.1:${ports.api}/api/health`)).ok,
    'real backend health',
    60000
  );
  const a = '014c3a938e943efecc152494bf279e3d8a3f3589';
  // Same current source, distinct build marker: exercises a real worker upgrade, not a new product revision.
  const b = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  let nextBuild;
  if (process.env.CART_PWA_REUSE_BUILDS) {
    // Developer retry optimization: only exact current frontend source and local generated fixtures.
    const cached = path.resolve(process.env.CART_PWA_REUSE_BUILDS);
    assert.ok(cached.startsWith(path.join(root, '.tmp', 'cart-pwa-isolated-')));
    execFileSync('git', ['diff', '--quiet', a, '--', 'frontend'], { cwd: root });
    for (const [name, revision] of [
      ['build-a', a],
      ['build-b', b],
    ]) {
      assert.ok(
        fs
          .readFileSync(path.join(cached, name, 'index.html'), 'utf8')
          .includes(`content="${revision}"`)
      );
      assert.ok(
        fs.readFileSync(path.join(cached, name, 'sw-menu-update.js'), 'utf8').includes(revision)
      );
      fs.cpSync(path.join(cached, name), path.join(dir, name), { recursive: true });
    }
    activeBuild = path.join(dir, 'build-a');
    nextBuild = path.join(dir, 'build-b');
  } else {
    activeBuild = await build(a, 'build-a');
    nextBuild = await build(b, 'build-b');
  }
  await staticServer();
  browser = await chromium.launch({
    headless: true,
    env,
    args: [
      '--no-proxy-server',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    ],
  });
  async function device() {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(u.hostname)) {
        network.blockedBrowser++;
        return route.abort();
      }
      if (u.pathname.startsWith('/api/'))
        network.apiPaths.add(`${route.request().method()} ${u.pathname}`);
      return route.continue();
    });
    return context;
  }
  const context = await device(),
    second = await device();
  const one = await context.newPage();
  const two = await second.newPage();
  const menu = '/menu/1?table=A1';
  await one.goto(origin + menu);
  await two.goto(origin + menu);
  const add = (page) =>
    page.getByRole('button', { name: 'Isolated Coffee 담기', exact: true }).click();
  await check('real API menu and service worker control', async () => {
    await one.getByRole('button', { name: 'Isolated Coffee 담기', exact: true }).waitFor();
    await waitFor(() => one.evaluate(() => !!navigator.serviceWorker.controller), 'worker control');
    assert.equal(await revision(one), a);
  });
  await check('two pages share cart through real backend Socket.IO', async () => {
    await add(one);
    await waitFor(async () => (await entries(two)).length === 1, 'second page receives cart');
  });
  await check('reload preserves cart and late join receives state', async () => {
    await two.reload();
    await waitFor(async () => (await entries(two)).length === 1, 'restore after reload');
    const third = await device(),
      late = await third.newPage();
    await late.goto(origin + menu);
    await waitFor(async () => (await entries(late)).length === 1, 'late join');
    await third.close();
  });
  await check('offline cart edit merges through backend after reconnect', async () => {
    await two.context().setOffline(true);
    await add(two);
    await two.context().setOffline(false);
    await waitFor(async () => (await quantity(one)) === 2, 'offline increment merged');
  });
  await check('waiting real worker preserves engaged carts without forced reload', async () => {
    activeBuild = nextBuild;
    await one.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    await two.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    await waitFor(
      () => one.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
      'waiting new worker',
      60000
    );
    await pause(3000);
    assert.equal(await revision(one), a);
    assert.equal(await revision(two), a);
    assert.equal(await quantity(one), 2);
    assert.equal(await quantity(two), 2);
  });
  await check('next QR entry and offline reload retain updated shell/cart', async () => {
    await one.goto(origin + menu + '&entry=next');
    assert.equal(await revision(one), b);
    await two.goto(origin + menu + '&entry=next');
    assert.equal(await revision(two), b);
    await waitFor(
      () => one.evaluate(async () => !(await navigator.serviceWorker.getRegistration())?.waiting),
      'new worker activation',
      30000
    );
    await context.setOffline(true);
    await one.reload();
    assert.equal(await revision(one), b);
    await one.getByRole('button', { name: 'Isolated Coffee 담기', exact: true }).waitFor();
    await one.getByText('장바구니 보기', { exact: true }).waitFor();
    assert.equal(await quantity(one), 2);
    await context.setOffline(false);
  });
  await check('deletion propagates and does not resurrect after peer reload', async () => {
    await one.getByText('장바구니 보기', { exact: true }).click();
    // One product may have independently-created cart IDs on the two devices.
    while ((await entries(one)).length)
      await one.locator('button:has(svg[class*="trash"])').first().click();
    await waitFor(async () => (await quantity(two)) === 0, 'remote tombstones');
    await two.reload();
    await two.getByRole('button', { name: 'Isolated Coffee 담기', exact: true }).waitFor();
    await pause(1500);
    assert.equal(await quantity(two), 0);
    assert.equal(await quantity(one), 0);
  });
  await one.screenshot({ path: path.join(dir, 'verified.png'), fullPage: false });
  const db = new Client({ connectionString: url });
  await db.connect();
  const counts = (
    await db.query(
      'SELECT (SELECT count(*)::int FROM public.orders) AS orders, (SELECT count(*)::int FROM public.payments) AS payments'
    )
  ).rows[0];
  await db.end();
  assert.deepEqual(counts, { orders: 0, payments: 0 });
  checks.push('no orders or payments created in isolated database');
  return {
    checks,
    counts,
    apiPaths: [...network.apiPaths],
    blockedBrowserRequests: network.blockedBrowser,
    buildA: a,
    buildB: b,
  };
}
(async () => {
  let result, error;
  try {
    result = await main();
  } catch (e) {
    error = e;
    console.error(e.message);
    if (browser) {
      for (const [i, page] of browser
        .contexts()
        .flatMap((c) => c.pages())
        .entries()) {
        await page.screenshot({ path: path.join(dir, `failure-${i}.png`) }).catch(() => {});
        fs.writeFileSync(
          path.join(dir, `failure-${i}.txt`),
          await page
            .locator('body')
            .innerText()
            .catch(() => 'unavailable')
        );
      }
    }
  } finally {
    if (browser) await browser.close();
    if (web) await new Promise((r) => web.close(r));
    for (const p of children) p.kill();
    if (pgStarted) run(exe('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.writeFileSync(
      path.join(dir, 'result.json'),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          node: process.version,
          passed: !error,
          error: error?.message,
          checks,
          ...result,
          cleanedUp: true,
        },
        null,
        2
      )
    );
    console.log(`Local evidence: ${path.relative(root, dir)}`);
  }
  if (error) process.exitCode = 1;
})();

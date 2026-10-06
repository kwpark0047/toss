// Offline diagnostics: evaluate current source with isolated dependency doubles.
// No database, network, dotenv, or production credentials are loaded.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const quiet = { info() {}, warn() {}, error() {}, log() {}, debug() {} };
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(read(file), {
    module, exports: module.exports,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    console: quiet, Buffer, process: { env: {} },
  }, { filename: file });
  return module.exports;
}
async function main() {
  let httpHandler;
  const bootstrap = read('index.mts').replace(/^import .*;\r?\n/gm, '').replace(/^export .*;\r?$/gm, '');
  vm.runInNewContext(bootstrap, {
    createServer(handler) { httpHandler = handler; return { listen(_port, cb) { cb(); } }; },
    path, process: { env: {} }, console: quiet,
  });
  const probe = (url) => {
    const res = { setHeader() {}, end(body) { this.body = body; } };
    httpHandler({ url }, res);
    return { status: res.statusCode, body: JSON.parse(res.body) };
  };
  assert.equal(probe('/api/health').status, 200);
  assert.equal(probe('/api/orders').status, 503);
  console.log('BOOTSTRAP: health=200; orders=503; actual Express app is never imported.');

  let corsMiddleware;
  const appSource = read('app.mts');
  const start = appSource.indexOf('app.use((req, res, next) => {');
  const end = appSource.indexOf('\n});', start) + 5;
  vm.runInNewContext(appSource.slice(start, end), {
    app: { use(fn) { corsMiddleware = fn; } },
    isOriginAllowed: () => true, allowedOrigins: [],
  });
  const headers = {};
  corsMiddleware({ method: 'OPTIONS', headers: { origin: 'https://wemarket.vercel.app' } }, {
    setHeader(k, v) { headers[k] = v; }, sendStatus() {},
  }, () => {});
  assert(!headers['Access-Control-Allow-Headers'].toLowerCase().includes('x-order-capability'));
  console.log('CORS: OPTIONS omits x-order-capability from Access-Control-Allow-Headers.');

  class MemoryCache {
    constructor() { this.map = new Map(); }
    get(key) { return this.map.get(key); }
    set(key, value) { this.map.set(key, value); }
    del(key) { this.map.delete(key); }
    flushAll() { this.map.clear(); }
  }
  const redis = { isConnected: true, async get() { return null; }, async set() {}, async del() {} };
  const idempotency = load('middleware/idempotency.js', {
    'node-cache': MemoryCache, '../utils/logger': quiet,
    '../utils/redisCache': redis, crypto: require('node:crypto'),
  });
  const middleware = idempotency({ namespace: 'payments:create' });
  const request = () => ({ headers: { 'idempotency-key': 'same-key' }, body: { amount: 100 }, user: { id: 1 } });
  const response = () => ({ json() {}, on() {}, statusCode: 200 });
  let entered = 0;
  await Promise.all([
    middleware(request(), response(), () => entered++),
    middleware(request(), response(), () => entered++),
  ]);
  assert.equal(entered, 2);
  console.log('IDEMPOTENCY: two simultaneous Redis cache misses enter the handler with the same key.');

  const points = load('services/PointsService.js', {
    '../config/prisma': {}, '../repositories/Point': {}, '../repositories/StoreTier': {},
  });
  points.findOrCreateUser = async () => ({ id: 1, total_points: 100 });
  let balance = 100;
  const transactions = [];
  const tx = {
    user_points: { async update({ data }) { balance = data.total_points; } },
    point_transactions: { async create({ data }) { transactions.push(data); return data; } },
  };
  await Promise.all([
    points.use(1, 1, 1, 'order-1', { phone: 'test' }, 80, tx),
    points.use(2, 2, 1, 'order-2', { phone: 'test' }, 80, tx),
  ]);
  assert.equal(balance, 20);
  assert.equal(transactions.reduce((sum, t) => sum - t.amount, 0), 160);
  console.log('POINTS: concurrent snapshot reads spend 160 from a balance of 100; stored balance=20.');
  console.log('All four offline diagnostic scenarios reproduced. These are isolated source-level reproductions, not live deployment or PostgreSQL tests.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

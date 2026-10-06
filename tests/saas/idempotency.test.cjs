const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function middleware(store) {
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../middleware/idempotency.js'), 'utf8'),
    {
      module,
      exports: module.exports,
      process: { env: {} },
      require(name) {
        if (name === 'crypto') return require('crypto');
        if (name === '../config/prisma') return { idempotencyRecord: store };
        if (name === '../utils/logger') return { warn() {}, error() {} };
        if (name === 'node-cache')
          return class {
            get() {}
            set() {}
            flushAll() {}
          };
        return { isConnected: false };
      },
    }
  );
  return module.exports({ namespace: 'test', required: true });
}
const req = (key = 'one', id = 1) => ({
  headers: { 'idempotency-key': key },
  body: { amount: 100 },
  method: 'POST',
  baseUrl: '/payments',
  path: `/${id}`,
  orderCapability: { orderId: id },
});
function res() {
  return {
    statusCode: 200,
    set() {
      return this;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    on() {},
  };
}
test('persistent unique key admits only one concurrent handler and survives middleware recreation', async () => {
  const records = new Map();
  const store = {
    async create({ data }) {
      if (records.has(data.id)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
      records.set(data.id, data);
      return data;
    },
    async findUnique({ where }) {
      return records.get(where.id);
    },
    async update({ where, data }) {
      Object.assign(records.get(where.id), data);
    },
  };
  const mw = middleware(store);
  let entered = 0;
  const first = res();
  await Promise.all([mw(req(), first, () => entered++), mw(req(), res(), () => entered++)]);
  assert.equal(entered, 1);
  await first.json({ success: true, id: 5 });
  const replay = res();
  await middleware(store)(req(), replay, () => entered++);
  assert.equal(entered, 1);
  assert.equal(replay.body.id, 5);
});
test('database failure rejects financial requests instead of bypassing idempotency', async () => {
  const mw = middleware({
    async create() {
      throw new Error('DB down');
    },
  });
  const response = res();
  let entered = false;
  await mw(req(), response, () => {
    entered = true;
  });
  assert.equal(entered, false);
  assert.equal(response.statusCode, 503);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
const quiet = { info() {}, warn() {}, error() {}, debug() {} };
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, file), 'utf8'),
    {
      module,
      exports: module.exports,
      Buffer,
      Date,
      setTimeout,
      clearTimeout,
      process: { env: { NODE_ENV: 'test' } },
      console: quiet,
      require(name) {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        if (['crypto', 'node:crypto'].includes(name)) return require(name);
        if (name === '../utils/errorHandler') return { AppError };
        if (name.endsWith('/logger')) return quiet;
        if (name === './directPayment') return load('services/directPayment.js');
        if (name === '../utils/subscriptionPolicy') return load('utils/subscriptionPolicy.js');
        return {};
      },
    },
    { filename: file }
  );
  return module.exports;
}

test('cash request attaches to the existing order and never records income before staff collection', async () => {
  let createdOrders = 0;
  let income = 0;
  const order = { id: 5, store_id: 1, total_amount: 1000, order_number: 'ONE', status: 'pending' };
  const tx = {
    $queryRaw: async () => [],
    orders: {
      findUnique: async () => order,
      update: async () => order,
      create: async () => {
        createdOrders++;
        return order;
      },
    },
    products: { findMany: async () => [{ id: 1 }] },
    payments: {
      findFirst: async () => null,
      aggregate: async () => ({ _sum: { amount: 0 } }),
      create: async ({ data }) => ({ id: 7, ...data }),
    },
  };
  const PaymentService = load('services/PaymentService.js', {
    '../config/prisma': { $transaction: (fn) => fn(tx) },
    '../utils/orderPricing': {
      priceOrderItem: () => ({
        product_id: 1,
        price: 1000,
        quantity: 1,
        subtotal: 1000,
        options: [],
      }),
      assertClientTotal() {},
    },
    './LedgerService': { recordIncome: async () => income++ },
    './PointsService': { calculateEarnPoints: async () => 0 },
  });
  const result = await new PaymentService().processDirectPayment({
    order_id: 5,
    store_id: 1,
    payment_method: 'cash',
    total_amount: 1000,
    items: [{ product_id: 1 }],
  });
  assert.equal(createdOrders, 0);
  assert.equal(result.order_id, 5);
  assert.equal(result.status, 'READY');
  assert.equal(income, 0);
});

test('point payments cannot complete with zero points', async () => {
  const service = load('services/PaymentService.js', {
    '../config/prisma': {
      $transaction: async () => {
        throw new Error('must reject before DB');
      },
    },
  });
  await assert.rejects(
    new service().processDirectPayment({ order_id: 1, payment_method: 'point', point_amount: 0 }),
    (e) => e.statusCode === 400
  );
});

test('two simultaneous point payments cannot spend more than the wallet balance', async () => {
  const points = load('services/PointsService.js');
  points.findOrCreateUser = async () => ({ id: 1, total_points: 100 });
  let balance = 100;
  let spent = 0;
  const tx = {
    user_points: {
      async update({ data }) {
        balance = data.total_points;
      },
      async updateMany({ where, data }) {
        if (balance < where.total_points.gte) return { count: 0 };
        balance -= data.total_points.decrement;
        return { count: 1 };
      },
      async findUnique() {
        return { id: 1, total_points: balance };
      },
    },
    point_transactions: {
      async create({ data }) {
        spent -= data.amount;
        return data;
      },
    },
  };
  const results = await Promise.allSettled([
    points.use(1, 1, 1, 'a', { user_id: 1 }, 80, tx),
    points.use(2, 2, 1, 'b', { user_id: 1 }, 80, tx),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(balance, 20);
  assert.equal(spent, 80);
});

test('unknown paid features deny access and enterprise unlimited resources are allowed', () => {
  const plans = load('middleware/planFeatures.js');
  assert.equal(plans.checkPlanFeature('pro', 'typoFeature'), false);
  assert.equal(plans.checkPlanFeature('enterprise', 'maxMenus'), true);
});

test('expired subscriptions fall back to free even if their stored plan is pro', async () => {
  const plans = load('middleware/planFeatures.js', {
    '../services/SubscriptionService': {
      getSubscription: async () => ({
        status: 'active',
        current_period_end: new Date('2020-01-01'),
        plan: { name: 'pro' },
      }),
    },
  });
  let outcome;
  await plans.requirePlanFeature('aiRecommendations')(
    { params: { storeId: '1' }, query: {} },
    {},
    (e) => {
      outcome = e || 'allowed';
    }
  );
  assert.equal(outcome.statusCode, 403);
});

test('billing periods clamp month ends and retain UTC time', () => {
  const policy = load('utils/subscriptionPolicy.js');
  assert.equal(
    policy.nextBillingPeriod(new Date('2026-01-31T10:00:00Z'), 'MONTHLY').toISOString(),
    '2026-02-28T10:00:00.000Z'
  );
  assert.equal(
    policy.nextBillingPeriod(new Date('2024-02-29T10:00:00Z'), 'YEARLY').toISOString(),
    '2025-02-28T10:00:00.000Z'
  );
});

test('the same point use can be reversed only once', async () => {
  const service = load('services/PointsService.js');
  let balance = 0;
  let reversal;
  const tx = { $queryRaw: async () => [], point_transactions: { findUnique: async () => reversal, create: async ({ data }) => { reversal = data; } }, user_points: { findFirst: async () => ({ id: 1, total_points: balance }), update: async ({ data }) => { balance = data.total_points; } } };
  const entry = { id: 99, user_point_id: 1, store_id: 1, order_id: 1, type: 'use', amount: -100 };
  await service._revertEntry(tx, entry);
  await service._revertEntry(tx, entry);
  assert.equal(balance, 100);
  assert.equal(reversal.reversal_of, 99);
});
test('offline refund requires collection confirmation and records each refund once', async () => {
  let refunds = 0;
  let status = 'DONE';
  const tx = { $queryRaw: async () => [], payments: { updateMany: async () => { if (status !== 'DONE') return { count: 0 }; status = 'CANCELED'; return { count: 1 }; } }, orders: { update: async () => {} }, order_items: { findMany: async () => [] } };
  const PaymentService = load('services/PaymentService.js', { '../config/prisma': { $transaction: (fn) => fn(tx) }, './PointsService': { revertOnCancel: async () => {} }, './LedgerService': { recordRefund: async () => { refunds++; } } });
  const service = new PaymentService();
  const payment = { id: 1, order_id: 1, store_id: 1, method: 'CASH', amount: 1000 };
  await assert.rejects(service.cancelOfflinePayment(payment, 'return', false), (e) => e.statusCode === 409);
  await service.cancelOfflinePayment(payment, 'return', true);
  await service.cancelOfflinePayment(payment, 'return', true);
  assert.equal(refunds, 1);
});
module.exports = { load, AppError };

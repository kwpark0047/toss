const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
// Never load .env or default to a developer/production database for destructive fixtures.
const url = new URL(process.env.P0_TEST_DATABASE_URL || 'http://missing');
if (url.hostname !== '127.0.0.1' || url.port !== '55438' || url.pathname !== '/wemarket_p0_schema_test')
  throw new Error('Use the dedicated P0_TEST_DATABASE_URL local isolated database');
process.env.DATABASE_URL = url.href;
process.env.DIRECT_URL = url.href;
process.env.REPLICA_URL = url.href;
process.env.REDIS_URL = '';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '1';
process.env.REDIS_PASSWORD = 'fixture-only';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'p0-isolated-jwt-secret-20261009';
process.env.ORDER_CAPABILITY_SECRET = 'p0-isolated-order-secret-20261009';
process.env.PHONE_ENC_KEY = 'p0-isolated-phone-secret-20261009';
process.env.TOSS_SECRET_KEY = 'test_sk_123';
process.env.GEMINI_API_KEY = 'p0-isolated-ai-fixture';
const { PrismaClient } = require('../../prisma/app/generated/prisma');
const db = new PrismaClient();
// Explicitly prohibit accidental provider traffic even when a test omits a stub.
require('axios').interceptors.request.use(config => {
  throw new Error('External HTTP is prohibited in isolated P0 tests');
});
const RefundService = require('../../services/RefundService');
const ledger = require('../../services/LedgerService');
let store;
before(async () => {
  // db push does not represent the partial unique index; apply its actual migration constraint.
  await db.$executeRawUnsafe("CREATE UNIQUE INDEX IF NOT EXISTS refund_operations_unresolved_payment ON public.refund_operations(payment_id) WHERE status IN ('processing','unknown')");
  await db.$executeRawUnsafe('ALTER TABLE public.refund_operations ENABLE ROW LEVEL SECURITY');
  const user = await db.users.create({ data: { password: 'fixture-only', email: `${crypto.randomUUID()}@test.invalid` } });
  store = await db.stores.create({ data: { user_id: user.id, name: 'isolated fixture' } });
});
after(async () => {
  await db.$disconnect(); await require('../../config/prisma').disconnectAll();
  await require('../../utils/redisCache').getRedisCache().disconnect();
  require('../../utils/cache').hybridCache.nodeCache.close();
  require('../../utils/dbCache').nodeCache.close();
});

async function fixture() {
  const product = await db.products.create({ data: { store_id: store.id, name: 'fixture', price: 10000, stock_quantity: 9 } });
  const order = await db.orders.create({ data: { store_id: store.id, order_number: crypto.randomUUID(), total_amount: 10000, payment_status: 'paid', status: 'confirmed' } });
  const payment = await db.payments.create({ data: { order_id: order.id, store_id: store.id, amount: 10000, method: 'CARD', status: 'DONE', payment_key: crypto.randomUUID() } });
  await db.stock_history.create({ data: { order_id: order.id, product_id: product.id, store_id: store.id, reason: 'ORDER', change: -1, qty_after: 9 } });
  let balance = 10000, calls = 0;
  const results = new Map();
  const result = () => ({ paymentKey: payment.payment_key, totalAmount: 10000, balanceAmount: balance, status: balance === 0 ? 'CANCELED' : 'PARTIAL_CANCELED' });
  const provider = {
    getPayment: async () => result(),
    cancelPayment: async (_payment, _reason, amount, key) => {
      if (results.has(key)) return results.get(key);
      calls++; balance -= amount;
      const value = result(); results.set(key, value); return value;
    },
  };
  const points = { revertOnCancel: async () => {} };
  const service = new RefundService({ db, provider, ledger, points });
  return { product, order, payment, provider, points, service, getCalls: () => calls };
}

test('partial then full: PG balance, positive ledger, order and stock converge once', async () => {
  const f = await fixture();
  await f.service.refund(f.payment.id, { amount: 2000, key: 'partial:1' });
  const result = await f.service.refund(f.payment.id, { key: 'full' });
  assert.equal(result.refundedAmount, 8000);
  await f.service.refund(f.payment.id, { key: 'full' });
  assert.equal(f.getCalls(), 2);
  const rows = await db.ledger.findMany({ where: { payment_id: f.payment.id, type: 'REFUND' } });
  assert.deepEqual(rows.map((r) => r.amount).sort((a,b) => a-b), [2000,8000]);
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 10);
  assert.equal((await db.orders.findUnique({ where: { id: f.order.id } })).payment_status, 'refunded');
});

test('PG success then DB failure rolls back ledger/stock and retry reconciles without another PG cancel', async () => {
  const f = await fixture();
  let fail = true;
  f.points.revertOnCancel = async () => { if (fail) throw new Error('injected DB settlement failure'); };
  await assert.rejects(f.service.refund(f.payment.id, { key: 'full' }), /injected/);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 0);
  assert.equal((await db.payments.findUnique({ where: { id: f.payment.id } })).status, 'DONE');
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 9);
  fail = false;
  await f.service.refund(f.payment.id, { key: 'full' });
  assert.equal(f.getCalls(), 1);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 10);
});

test('concurrent distinct refunds cannot spend the same remaining balance', async () => {
  const f = await fixture();
  const results = await Promise.allSettled(['a','b'].map((key) => f.service.refund(f.payment.id, { amount: 7000, key })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.getCalls(), 1);
  assert.equal((await db.ledger.aggregate({ where: { payment_id: f.payment.id }, _sum: { amount: true } }))._sum.amount, 7000);
});

test('lost PG response blocks a different key; same key recovers from provider state', async () => {
  const f = await fixture();
  const cancel = f.provider.cancelPayment;
  let lost = true;
  f.provider.cancelPayment = async (...args) => { const value = await cancel(...args); if (lost) { lost = false; throw new Error('response lost'); } return value; };
  await assert.rejects(f.service.refund(f.payment.id, { amount: 4000, key: 'first' }), /response lost/);
  await assert.rejects(f.service.refund(f.payment.id, { amount: 4000, key: 'different' }), (e) => e.statusCode === 409);
  await f.service.refund(f.payment.id, { amount: 4000, key: 'first' });
  assert.equal(f.getCalls(), 1);
  assert.equal((await db.ledger.aggregate({ where: { payment_id: f.payment.id }, _sum: { amount: true } }))._sum.amount, 4000);
});

test('legacy negative partial row is individually normalized for remaining amount', async () => {
  const f = await fixture();
  await f.service.refund(f.payment.id, { amount: 2000, key: 'first' });
  await db.ledger.updateMany({ where: { payment_id: f.payment.id }, data: { amount: -2000 } });
  const result = await f.service.refund(f.payment.id, { key: 'full' });
  assert.equal(result.refundedAmount, 8000);
});

test('no stock deduction means no refund stock increment', async () => {
  const f = await fixture();
  await db.stock_history.deleteMany({ where: { order_id: f.order.id } });
  await f.service.refund(f.payment.id, { key: 'full' });
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 9);
});

test('offline split refunds keep the order paid until the last payment and restore deducted inventory once', async () => {
  const f = await fixture();
  await db.payments.update({ where: { id: f.payment.id }, data: { amount: 5000, method: 'CASH', payment_key: null } });
  const first = { ...f.payment, amount: 5000, method: 'CASH', payment_key: null };
  const second = await db.payments.create({ data: { order_id: f.order.id, store_id: store.id, amount: 5000, method: 'CASH', status: 'DONE' } });
  const PaymentService = require('../../services/PaymentService');
  const service = new PaymentService();
  await service.cancelOfflinePayment(first, 'fixture', true);
  assert.notEqual((await db.orders.findUnique({ where: { id: f.order.id } })).payment_status, 'refunded');
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 9);
  await service.cancelOfflinePayment(second, 'fixture', true);
  await service.cancelOfflinePayment(second, 'fixture', true);
  assert.equal((await db.orders.findUnique({ where: { id: f.order.id } })).payment_status, 'refunded');
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 10);
});

test('customer history repository enforces store scope even when both stores have the same phone', async () => {
  const f = await fixture();
  const other = await db.stores.create({ data: { user_id: store.user_id, name: 'other tenant' } });
  await db.orders.update({ where: { id: f.order.id }, data: { customer_phone: '01011112222' } });
  await db.orders.create({ data: { store_id: other.id, order_number: crypto.randomUUID(), customer_phone: '01011112222' } });
  const rows = await require('../../repositories/Order').findByCustomerInStore(store.id, '01011112222');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, f.order.id);
  assert.ok(rows.every((row) => row.store_id === store.id));
});

test('manager revenue subtracts each mixed-sign historical refund rather than their net sum', async () => {
  store = await db.stores.create({ data: { user_id: store.user_id, name: 'isolated manager refund fixture' } });
  const f = await fixture();
  await db.orders.update({ where: { id: f.order.id }, data: { created_at: new Date('2026-10-07T12:00:00Z') } });
  for (const amount of [-1000, 2000]) await db.ledger.create({ data: { payment_id: f.payment.id, order_id: f.order.id,
    store_id: store.id, amount, type: 'REFUND', category: 'fixture' } });
  const data = await new (require('../../services/StoreManagerService'))(db).collect(store.id, new Date('2026-10-07T14:00:00Z'));
  assert.equal(data.current.revenue, 7000);
});

test('settlement reads current store config and mixed-sign refunds without cancellation of amounts', async () => {
  store = await db.stores.create({ data: { user_id: store.user_id, name: 'isolated settlement fixture' } });
  const f = await fixture();
  await db.store_settlement_config.create({ data: { store_id: store.id, commission_rate: 0.03, vat_rate: 0.1 } });
  for (const [type,amount] of [['INCOME',10000],['REFUND',-2000],['REFUND',8000]]) {
    await db.ledger.create({ data: { payment_id: f.payment.id, order_id: f.order.id, store_id: store.id,
      amount, type, category: 'fixture', method: 'CARD', created_at: new Date('2026-10-07T12:00:00Z') } });
  }
  const result = await require('../../repositories/Settlement').create({ store_id: store.id, period_start: '2026-10-07', period_end: '2026-10-07' });
  assert.equal(result.total_sales, 10000);
  assert.equal(result.total_refunds, 10000);
  assert.equal(result._calc.netSales, 0);
});

test('partial API retries stay bound to their original payment after it is fully refunded', async () => {
  const f = await fixture();
  await f.service.refund(f.payment.id, { amount: 10000, key: 'partial:stable-key' });
  const PaymentService = require('../../services/PaymentService');
  const replay = await new PaymentService().processPartialCancel(f.order.id, 10000, 'retry', 'stable-key');
  assert.equal(replay.alreadyRefunded, true);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
});

test('actual refund HTTP route recovers PG success/DB failure and replays after CANCELED without duplicate PG effect', async () => {
  const f = await fixture();
  const express = require('express'), request = require('supertest'), jwt = require('jsonwebtoken');
  const toss = require('../../utils/toss'), points = require('../../services/PointsService');
  const original = { cancel: toss.cancelPayment, get: toss.getPayment, revert: points.revertOnCancel };
  let fail = true;
  toss.cancelPayment = f.provider.cancelPayment; toss.getPayment = f.provider.getPayment;
  points.revertOnCancel = async (...args) => { if (fail) throw new Error('injected settlement failure'); return original.revert.apply(points, args); };
  const app = express(); app.use(express.json()); app.use('/api/payments', require('../../routes/payments'));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  const {token} = await require('../../services/AuthSessionService').issue(await db.users.findUnique({where:{id:store.user_id}}));
  const send = () => request(app).post(`/api/payments/order/${f.order.id}/partial-cancel`)
    .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', `http-${f.payment.id}`)
    .send({ cancelAmount: 10000, cancelReason: 'fixture' });
  try {
    assert.equal((await send()).status, 500);
    fail = false;
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 200);
    assert.equal(f.getCalls(), 1);
    assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
  } finally { toss.cancelPayment = original.cancel; toss.getPayment = original.get; points.revertOnCancel = original.revert; }
});

test('legacy partial refund key is replayed without a second provider refund after upgrade', async () => {
  const f = await fixture();
  const key = `legacy-${f.payment.id}`;
  await f.provider.cancelPayment(f.payment.payment_key, 'legacy', 2000, `partial-refund:${key}`);
  await db.ledger.create({ data: { payment_id: f.payment.id, order_id: f.order.id, store_id: store.id,
    amount: -2000, type: 'REFUND', category: 'PARTIAL_CANCEL', event_key: `partial-refund:${key}` } });
  const service = new (require('../../services/PaymentService'))();
  const toss = require('../../utils/toss');
  const original = toss.cancelPayment; toss.cancelPayment = f.provider.cancelPayment;
  try {
    const result = await service.processPartialCancel(f.order.id, 2000, 'legacy', key);
    assert.equal(result.alreadyRefunded, true);
    assert.equal(result.refundedAmount, 2000);
    assert.equal(f.getCalls(), 1);
  } finally { toss.cancelPayment = original; }
});

test('inconsistent payment/order tenant is rejected before any provider side effect', async () => {
  const f = await fixture();
  const other = await db.stores.create({ data: { user_id: store.user_id, name: 'mismatched tenant fixture' } });
  await db.payments.update({ where: { id: f.payment.id }, data: { store_id: other.id } });
  await assert.rejects(f.service.refund(f.payment.id, { key: 'full' }), (e) => e.statusCode === 409);
  assert.equal(f.getCalls(), 0);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 0);
});

test('upgrade retains the old PG partial idempotency key even when its legacy response and ledger were lost', async () => {
  const f = await fixture(), key = `lost-legacy-${crypto.randomUUID()}`;
  await f.provider.cancelPayment(f.payment.payment_key, 'legacy', 2000, `partial-refund:${key}`);
  const toss = require('../../utils/toss'), original = { cancel: toss.cancelPayment, get: toss.getPayment };
  toss.cancelPayment = f.provider.cancelPayment; toss.getPayment = f.provider.getPayment;
  try {
    const result = await new (require('../../services/PaymentService'))().processPartialCancel(f.order.id, 2000, 'legacy', key);
    assert.equal(result.refundedAmount, 2000);
    assert.equal(f.getCalls(), 1);
    assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
  } finally { toss.cancelPayment = original.cancel; toss.getPayment = original.get; }
});

test('PG/local divergence blocks a new financial effect before cancel', async () => {
  const f = await fixture();
  await f.provider.cancelPayment(f.payment.payment_key, 'outside operation', 1000, 'external');
  await assert.rejects(f.service.refund(f.payment.id, { amount: 2000, key: 'new' }), /대사/);
  assert.equal(f.getCalls(), 1);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 0);
});

test('partial + partial + remaining full cancellation keeps PG and ledger equal', async () => {
  const f = await fixture();
  await ledger.recordIncome({ storeId: store.id, orderId: f.order.id, paymentId: f.payment.id, amount: 10000, method: 'CARD' }, db);
  await f.service.refund(f.payment.id, { amount: 2000, key: 'one' });
  assert.equal((await require('../../repositories/Ledger').getSummary(store.id, new Date(Date.now()-60000), new Date(Date.now()+60000))).total_income >= 10000, true);
  await f.service.refund(f.payment.id, { amount: 3000, key: 'two' });
  assert.equal((await f.service.refund(f.payment.id, { key: 'remaining' })).refundedAmount, 5000);
  assert.equal((await f.provider.getPayment()).balanceAmount, 0);
  assert.equal((await db.ledger.aggregate({ where: { payment_id: f.payment.id, type: 'REFUND' }, _sum: { amount: true } }))._sum.amount, 10000);
  const income = await db.ledger.aggregate({ where: { payment_id: f.payment.id, type: 'INCOME' }, _sum: { amount: true } });
  const refunds = await db.ledger.aggregate({ where: { payment_id: f.payment.id, type: 'REFUND' }, _sum: { amount: true } });
  assert.equal(income._sum.amount-refunds._sum.amount, (await f.provider.getPayment()).balanceAmount);
});

test('inventory fault survives a new service instance and recovery applies unique compensation once', async () => {
  const f = await fixture();
  f.service.restoreInventory = async () => { throw new Error('injected inventory failure'); };
  await assert.rejects(f.service.refund(f.payment.id, { key: 'restart' }), /inventory failure/);
  assert.equal((await db.inventory_compensations.findUnique({ where: { order_id: f.order.id } })).status, 'pending');
  const restarted = new RefundService({ db, provider: f.provider, ledger, points: f.points });
  const results = await restarted.resumePendingRefunds({ storeId: store.id });
  assert.equal(results.find(r => r.paymentId === f.payment.id).status, 'confirmed');
  await restarted.refund(f.payment.id, { key: 'restart' });
  assert.equal(f.getCalls(), 1);
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 10);
  const stock = await db.stock_history.findFirst({ where: { order_id: f.order.id, reason: 'CANCEL' } });
  assert.ok(stock.compensation_key);
  await assert.rejects(db.stock_history.create({ data: { product_id: f.product.id, store_id: store.id,
    order_id: f.order.id, reason: 'CANCEL', change: 1, qty_after: 11, compensation_key: stock.compensation_key } }), e => e.code === 'P2002');
});

test('expired processing lease can be resumed after process exit without another PG effect', async () => {
  const f = await fixture();
  f.points.revertOnCancel = async () => { throw new Error('crashed finalizer'); };
  await assert.rejects(f.service.refund(f.payment.id, { key: 'lease' }));
  await db.refund_operations.updateMany({ where: { payment_id: f.payment.id }, data: {
    status: 'processing', owner: crypto.randomUUID(), lease_until: new Date(Date.now() - 1000) } });
  const restarted = new RefundService({ db, provider: f.provider, ledger, points: { revertOnCancel: async () => {} } });
  await restarted.resumePendingRefunds({ storeId: store.id });
  assert.equal((await db.payments.findUnique({ where: { id: f.payment.id } })).status, 'CANCELED');
  assert.equal(f.getCalls(), 1);
});

test('real AI HTTP identity/consent boundary excludes anonymous, other customer and other store histories from LLM payload', async () => {
  const f = await fixture();
  const { encryptPhone } = require('../../utils/phoneEncryption');
  const user = await db.users.create({ data: { password: 'fixture-only', email: `${crypto.randomUUID()}@test.invalid` } });
  const phone = `010${String(10000000 + user.id)}`;
  await db.users.update({ where: { id: user.id }, data: { phone: encryptPhone(phone) } });
  await db.orders.update({ where: { id: f.order.id }, data: { customer_phone: encryptPhone(phone) } });
  await db.order_items.create({ data: { order_id: f.order.id, product_name: 'OWN HISTORY', price: 10000, quantity: 1, subtotal: 10000 } });
  const otherStore = await db.stores.create({ data: { user_id: store.user_id, name: 'other identity tenant' } });
  for (const [storeId, customerPhone, name] of [[store.id, '01088887777', 'OTHER CUSTOMER'], [otherStore.id, phone, 'OTHER STORE']]) {
    const order = await db.orders.create({ data: { store_id: storeId, order_number: crypto.randomUUID(), customer_phone: encryptPhone(customerPhone) } });
    await db.order_items.create({ data: { order_id: order.id, product_name: name, price: 1, quantity: 1, subtotal: 1 } });
  }
  await db.customer_ai_consents.create({ data: { store_id: store.id, user_id: user.id,
    verified_phone: encryptPhone(phone), verified_at: new Date(), consent_at: new Date() } });
  const AI = require('../../services/aiService'), Context = require('../../services/RecommendationContextService');
  const Product = require('../../repositories/Product'), Order = require('../../repositories/Order');
  const weather = require('../../services/weatherService');
  const original = { recommend: AI.recommendMenus, context: Context.buildContext, menu: Product.findActiveAndInStock,
    trending: Order.findTrendingProducts, history: Order.findByCustomerInStore, weather: weather.getEnhancedWeatherContext };
  const payloads = []; let reads = 0;
  AI.recommendMenus = async ctx => { payloads.push(ctx); return [{ id: f.product.id }]; };
  Context.buildContext = async () => ({});
  Product.findActiveAndInStock = async () => [f.product];
  Order.findTrendingProducts = async () => [];
  Order.findByCustomerInStore = async (...args) => { reads++; return original.history(...args); };
  weather.getEnhancedWeatherContext = async () => null;
  const express = require('express'), request = require('supertest'), jwt = require('jsonwebtoken');
  const app = express(); app.use(express.json()); app.use('/api/ai', require('../../routes/ai'));
  const {token} = await require('../../services/AuthSessionService').issue(user);
  const send = (path, storeId, bearer = token) => request(app).post(`/api/ai/${path}`)
    .set('Authorization', `Bearer ${bearer}`).send({ store_id: storeId, phone: '01088887777', toss_user_key: 'tampered' });
  try {
    assert.equal((await send('recommend', store.id, 'invalid')).status, 200);
    assert.equal((await send('recommend', store.id)).status, 200);
    assert.equal(reads, 0);
    assert.equal((await send('personalized-recommend', store.id, 'invalid')).status, 401);
    assert.equal((await send('personalized-recommend', store.id)).status, 200);
    assert.equal(reads, 1);
    assert.deepEqual(payloads.at(-1).pastOrders, ['OWN HISTORY']);
    assert.equal((await send('personalized-recommend', otherStore.id)).status, 200);
    assert.deepEqual(payloads.at(-1).pastOrders, []);
    assert.equal(reads, 1);
    await db.customer_ai_consents.update({ where: { store_id_user_id: { store_id: store.id, user_id: user.id } }, data: { revoked_at: new Date() } });
    assert.equal((await send('personalized-recommend', store.id)).status, 200);
    assert.equal(reads, 1);
    assert.ok(!JSON.stringify(payloads).includes('OTHER CUSTOMER'));
    assert.ok(!JSON.stringify(payloads).includes('OTHER STORE'));
    assert.deepEqual(await Order.findByCustomer(phone, 'tampered'), []);
  } finally {
    AI.recommendMenus = original.recommend; Context.buildContext = original.context;
    Product.findActiveAndInStock = original.menu; Order.findTrendingProducts = original.trending;
    Order.findByCustomerInStore = original.history; weather.getEnhancedWeatherContext = original.weather;
  }
});

test('a separate Node process recovers persisted PG success after inventory finalization failed', async () => {
  const f = await fixture();
  f.service.restoreInventory = async () => { throw new Error('failed before stock commit'); };
  await assert.rejects(f.service.refund(f.payment.id, { key: 'child-recovery' }));
  const { execFileSync } = require('node:child_process');
  const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/test-refund-recovery-child.cjs'], {
    cwd: require('node:path').resolve(__dirname, '../..'), timeout: 15000,
    env: { ...process.env, P0_TEST_OPERATION_KEY: `refund:${f.payment.id}:child-recovery` }, encoding: 'utf8'
  });
  assert.ok(output.includes('RECOVERY_CONFIRMED'));
  assert.equal(f.getCalls(), 1);
  assert.equal((await db.payments.findUnique({ where: { id: f.payment.id } })).status, 'CANCELED');
  assert.equal((await db.products.findUnique({ where: { id: f.product.id } })).stock_quantity, 10);
});

test('stale worker cannot overwrite a recovered refund after lease ownership changes', async () => {
  const f = await fixture();
  const cancel = f.provider.cancelPayment;
  let release, reached;
  const gated = new Promise(resolve => { reached = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  let first = true;
  f.provider.cancelPayment = async (...args) => {
    const value = await cancel(...args);
    if (first) { first = false; reached(); await wait; }
    return value;
  };
  const pending = f.service.refund(f.payment.id, { key: 'stale-owner' });
  // Attach the rejection handler before releasing the old worker.
  const oldResult = pending.then(() => 'unexpected', () => 'rejected');
  await gated;
  await db.refund_operations.updateMany({ where: { payment_id: f.payment.id }, data: { lease_until: new Date(Date.now()-1000) } });
  await new RefundService({ db, provider: f.provider, ledger, points: f.points }).refund(f.payment.id, { key: 'stale-owner' });
  release();
  assert.equal(await oldResult, 'rejected');
  assert.equal((await db.refund_operations.findFirst({ where: { payment_id: f.payment.id } })).status, 'confirmed');
  assert.equal(f.getCalls(), 1);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
});

test('migration server-only tables have RLS and do not grant PUBLIC access', async () => {
  const tables = await db.$queryRaw`SELECT relname, relrowsecurity FROM pg_class
    WHERE oid IN ('public.customer_ai_consents'::regclass,'public.inventory_compensations'::regclass)`;
  assert.equal(tables.length, 2);
  assert.ok(tables.every(table => table.relrowsecurity));
  const grants = await db.$queryRaw`SELECT table_name FROM information_schema.table_privileges
    WHERE grantee='PUBLIC' AND table_schema='public' AND table_name IN ('customer_ai_consents','inventory_compensations')`;
  assert.equal(grants.length, 0);
});

test('bounded history HTTP returns owned IDs in one store and rejects legacy proof', async () => {
  const f = await fixture();
  const other = await db.stores.create({ data: { user_id: store.user_id, name: 'history other store' } });
  const foreign = await db.orders.create({ data: { store_id: other.id, order_number: crypto.randomUUID() } });
  const unowned = await db.orders.create({ data: { store_id: store.id, order_number: crypto.randomUUID() } });
  const express = require('express'), request = require('supertest'), jwt = require('jsonwebtoken');
  const { createCustomerHistoryCapability } = require('../../utils/orderCapability');
  const app = express(); app.use(express.json());
  app.use((_req,res,next) => { res.success = data => res.json({ success: true, data }); next(); });
  app.use('/api/orders', require('../../routes/orders'));
  const proof = createCustomerHistoryCapability({ store_id: store.id, order_ids: [f.order.id, foreign.id] });
  const response = await request(app).get('/api/orders/customer/history').set('x-customer-history-capability', proof);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map(order => order.id), [f.order.id]);
  assert.ok(!response.body.data.some(order => order.id === unowned.id));
  const legacy = jwt.sign({ type: 'customer_history_capability', phone: '01011112222' }, process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET);
  assert.equal((await request(app).get('/api/orders/customer/history').set('x-customer-history-capability', legacy)).status, 403);
});

test('ordinary database role cannot read server-only identity or compensation records', async () => {
  await db.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='p0_isolated_untrusted') THEN CREATE ROLE p0_isolated_untrusted; END IF; END $$");
  for (const table of ['customer_ai_consents','inventory_compensations']) {
    await assert.rejects(db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE p0_isolated_untrusted');
      await tx.$queryRawUnsafe(`SELECT * FROM public.${table}`);
    }), error => error.code === 'P2010' && error.meta?.code === '42501');
  }
});

test('PG success before durable result save failure resumes using the original provider key', async () => {
  const f = await fixture();
  let fail = true;
  const faultyDb = new Proxy(db, { get(target, prop) {
    if (prop === 'refund_operations') return new Proxy(target.refund_operations, { get(delegate, method) {
      if (method === 'updateMany') return async args => {
        if (args.data.provider_result && fail) { fail = false; throw new Error('injected result journal DB failure'); }
        return delegate.updateMany(args);
      };
      return delegate[method];
    } });
    const value = target[prop]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  const service = new RefundService({ db: faultyDb, provider: f.provider, ledger, points: f.points });
  await assert.rejects(service.refund(f.payment.id, { amount: 3000, key: 'journal-fault' }), /journal DB failure/);
  const intent = await db.refund_operations.findFirst({ where: { payment_id: f.payment.id } });
  assert.equal(intent.status, 'unknown'); assert.equal(intent.provider_result, null);
  await new RefundService({ db, provider: f.provider, ledger, points: f.points }).refund(f.payment.id, { amount: 3000, key: 'journal-fault' });
  assert.equal(f.getCalls(), 1);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 1);
});

test('very old unknown provider effects stop for reconciliation rather than risk a second refund', async () => {
  const f = await fixture();
  const cancel = f.provider.cancelPayment;
  f.provider.cancelPayment = async (...args) => { await cancel(...args); throw new Error('lost'); };
  await assert.rejects(f.service.refund(f.payment.id, { amount: 3000, key: 'old-unknown' }));
  await db.refund_operations.updateMany({ where: { payment_id: f.payment.id }, data: { created_at: new Date(Date.now()-2*86400000) } });
  f.provider.cancelPayment = cancel;
  await assert.rejects(f.service.refund(f.payment.id, { amount: 3000, key: 'old-unknown' }), /대사/);
  assert.equal(f.getCalls(), 1);
  assert.equal(await db.ledger.count({ where: { payment_id: f.payment.id } }), 0);
});

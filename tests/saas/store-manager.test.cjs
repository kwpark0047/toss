const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const request = require('supertest');
const { analyze, localClock, compareEvaluation } = require('../../utils/storeManagerAnalysis');
const now = new Date('2026-10-07T07:30:00Z');
const fixture = () => ({ hourly: [], products: [], review: { count: 0, low: 0 }, connections: [], overview: { total_revenue: 0 } });
test('manager uses Korean local clock and never invents a comparison with sparse orders', () => {
  assert.deepEqual(localClock(new Date('2026-10-06T15:00:00Z')), { date: '2026-10-07', hour: 0, weekday: 3 });
  const result = analyze(fixture(), now);
  assert.equal(result.insights[0].key, 'insufficient');
  assert.equal(result.historical.revenue, null); assert.equal(result.proposals.length, 0);
});
test('manager compares completed same-weekday hours, excludes future hours, and prioritizes missing collection', () => {
  const data = fixture();
  for (const date of ['2026-09-30', '2026-09-23', '2026-09-16', '2026-09-09']) data.hourly.push({ date, hour: 10, orders: 10, revenue: 100000 }, { date, hour: 18, orders: 100, revenue: 1000000 });
  data.hourly.push({ date: '2026-10-07', hour: 10, orders: 5, revenue: 50000 }, { date: '2026-10-07', hour: 18, orders: 999, revenue: 9999999 });
  data.connections.push({ enabled: true, last_ingested_at: null });
  const result = analyze(data, now);
  assert.equal(result.current.revenue, 50000); assert.equal(result.historical.revenue, 100000);
  assert.equal(result.insights[0].key, 'stale'); assert.ok(result.insights.some(i => i.key === 'sales_drop'));
});
test('recommendations require observed saleable menu data and never promote sold-out or foreign item claims', () => {
  const data = fixture();
  for (let day = 1; day <= 10; day++) data.hourly.push({ date: `2026-10-${String(day <= 6 ? day : day - 4).padStart(2, '0')}`, hour: 10, orders: 10, revenue: 10000 });
  data.products = [{ id: 1, name: '품절', quantity: 100, is_active: true, is_sold_out: true }, { id: 2, name: '추천', quantity: 20, is_active: true, is_sold_out: false, stock_quantity: null }];
  const result = analyze(data, now);
  assert.equal(result.proposals[0].product_id, 2);
  data.products[1].stock_quantity = 0; assert.equal(analyze(data, now).proposals.length, 0);
});
test('performance reports sample size and observed change without claiming causal lift', () => {
  assert.equal(compareEvaluation({ orders: 29, share: .1 }, { orders: 40, share: .5 }).verdict, 'insufficient');
  const result = compareEvaluation({ orders: 40, share: .2 }, { orders: 50, share: .3 });
  assert.equal(result.verdict, 'observed_improvement'); assert.equal(result.delta_share_points, 10); assert.equal(result.causal, false);
});
test('actual manager router restricts foreign tenants, staff and manager execution; public endpoint exposes only featured products', async () => {
  const calls = [];
  class Service { async featured(id) { calls.push(['featured', id]); return []; } async briefing(id) { calls.push(['briefing', id]); return {}; } async transition(...args) { calls.push(args); return {}; } }
  const auth = (req, res, next) => { if (!req.headers['x-user']) return res.status(401).end(); req.user = { id: 7, role: 'user' }; next(); };
  const context = { module: { exports: {} }, require: name => {
    if (name === '../middleware/auth') return auth;
    if (name === '../middleware/storeAuth') return { getStoreRole: async (_id, sid) => ({ 3: 'owner', 4: 'manager', 5: 'staff' })[sid] };
    if (name === '../services/StoreManagerService') return Service;
    if (name === '../utils/catchAsync') return require('../../utils/catchAsync');
    if (name === '../utils/errorHandler') return require('../../utils/errorHandler');
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync('routes/storeManager.js', 'utf8'), context);
  const app = express(); app.use(express.json()); app.use((_req, res, next) => { res.success = data => res.json({ data }); next(); }); app.use('/manager', context.module.exports); app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ error: err.message }));
  await request(app).get('/manager/stores/3/featured').expect(200);
  await request(app).get('/manager/stores/3/briefing').expect(401);
  await request(app).get('/manager/stores/6/briefing').set('x-user', 'yes').expect(403);
  await request(app).get('/manager/stores/5/briefing').set('x-user', 'yes').expect(403);
  await request(app).post('/manager/stores/4/actions/test/execute').set('x-user', 'yes').expect(403);
  await request(app).get('/manager/stores/0/featured').expect(400);
  assert.deepEqual(calls, [['featured', 3]]);
  const response = await request(app).get('/manager/stores/4/briefing').set('x-user', 'yes').expect(200);
  assert.equal(response.body.data.can_execute, false);
});

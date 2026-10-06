const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const kstTime = require('../../utils/kstTime');

function load(file, dependencies) {
  const context = { module: { exports: {} }, console, require: name => {
    if (name.includes('dataLoaders')) throw new Error('Legacy loaders must not be used for store lists');
    return dependencies[name] || {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
  return context.module.exports;
}

test('store order lists reuse repository items and payments without legacy loaders', async () => {
  const orders = [{ id: 1, items: [{ id: 2 }], payments: [{ id: 3 }] }];
  const controller = load('../../controllers/orderController', {
    '../repositories/Order': { findByStoreId: async () => orders },
    '../utils/catchAsync': handler => handler,
  });
  let response;
  await controller.getStoreOrders({ params: { storeId: '3' }, query: {} }, { success: data => { response = data; } });
  assert.equal(response, orders);
  assert.equal(response[0].items[0].id, 2);
  assert.equal(response[0].payments[0].id, 3);
});

test('dashboard summaries include the full selected KST day', async () => {
  let where;
  const repository = load('../../repositories/Order', {
    '../utils/kstTime': kstTime,
    '../config/prisma': { orders: {
      aggregate: async args => { where = args.where; return { _count: { id: 0 }, _sum: { total_amount: 0 } }; },
      groupBy: async () => [],
    } },
  });
  await repository.getStats(3, '2026-10-06', '2026-10-06');
  assert.equal(where.created_at.gte.toISOString(), '2026-10-05T15:00:00.000Z');
  assert.equal(where.created_at.lte.toISOString(), '2026-10-06T14:59:59.999Z');
});

test('hourly dashboard data uses Korea time', async () => {
  const repository = load('../../repositories/Order', {
    '../utils/kstTime': kstTime,
    '../config/prisma': { orders: { findMany: async () => [{ id: 1, total_amount: 1000, created_at: new Date('2026-10-05T15:30:00Z'), status: 'completed' }] } },
  });
  const result = await repository.getDetailedStats(3, '2026-10-06', '2026-10-06');
  assert.equal(result.daily[0].date, '2026-10-06');
  assert.equal(result.hourly[0].count, 1);
});

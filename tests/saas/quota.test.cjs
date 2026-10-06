const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const moduleStub = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../utils/planQuota.js'), 'utf8'), {
  module: moduleStub,
  Date,
  Number,
  require(name) {
    if (name === './subscriptionPolicy') return require('../../utils/subscriptionPolicy');
    if (name === './errorHandler')
      return {
        AppError: class extends Error {
          constructor(m, status) {
            super(m);
            this.statusCode = status;
          }
        },
      };
    return {
      PLAN_FEATURES: {
        maxMenus: { free: 50, pro: 200, enterprise: -1 },
        maxStaff: { free: 1, pro: 10, enterprise: -1 },
        ordersPerMonth: { free: 1000, pro: 10000, enterprise: -1 },
      },
    };
  },
});
const { assertPlanQuota, planLimit } = moduleStub.exports;
test('tenant row is locked before counting and free menu limit rejects the boundary', async () => {
  const calls = [];
  const tx = {
    $queryRaw: async () => calls.push('lock'),
    subscription: { findUnique: async () => null },
    products: {
      count: async () => {
        calls.push('count');
        return 50;
      },
    },
  };
  await assert.rejects(assertPlanQuota(tx, 7, 'maxMenus'), (e) => e.statusCode === 403);
  assert.deepEqual(calls, ['lock', 'count']);
});
test('expired custom limits cannot retain paid access', () => {
  assert.equal(
    planLimit(
      {
        status: 'active',
        current_period_end: new Date('2000-01-01'),
        plan: { name: 'enterprise', limits: { maxMenus: -1 } },
      },
      'maxMenus'
    ),
    50
  );
});
test('active enterprise unlimited avoids resource counting', async () => {
  const tx = {
    $queryRaw: async () => {},
    subscription: {
      findUnique: async () => ({
        status: 'active',
        current_period_end: new Date(Date.now() + 86400000),
        plan: { name: 'enterprise' },
      }),
    },
    products: {
      count: () => {
        throw new Error('unlimited must not count');
      },
    },
  };
  await assertPlanQuota(tx, 1, 'maxMenus');
});

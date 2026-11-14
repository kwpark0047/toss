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
    $queryRaw: async (sql) => {
      if (sql.join('').includes('FOR UPDATE')) return calls.push('lock');
      calls.push('trial');
      return [];
    },
    subscription: { findUnique: async () => null },
    products: {
      count: async () => {
        calls.push('count');
        return 50;
      },
    },
  };
  await assert.rejects(assertPlanQuota(tx, 7, 'maxMenus'), (e) => e.statusCode === 403);
  assert.deepEqual(calls, ['lock', 'trial', 'count']);
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

// 신규 가입 1개월 프로 체험: 결제 구독이 없어도 체험 중에는 프로 한도, 끝나면 무료 한도
const future = () => new Date(Date.now() + 86400000);
const past = () => new Date(Date.now() - 86400000);
test('active owner trial grants pro limits without a paid subscription', () => {
  assert.equal(planLimit(null, 'maxMenus', future()), 200);
  assert.equal(planLimit(null, 'maxStaff', future()), 10);
});
test('expired owner trial falls back to free limits', () => {
  assert.equal(planLimit(null, 'maxMenus', past()), 50);
  assert.equal(planLimit(null, 'maxStaff', past()), 1);
});
test('a paid enterprise subscription wins over an active trial', () => {
  const sub = { status: 'active', current_period_end: future(), plan: { name: 'enterprise' } };
  assert.equal(planLimit(sub, 'maxMenus', future()), -1);
});
test('an expired paid pro plan does not leak its custom limits into the trial', () => {
  const sub = {
    status: 'active',
    current_period_end: past(),
    plan: { name: 'pro', limits: { maxMenus: 9999 } },
  };
  assert.equal(planLimit(sub, 'maxMenus', future()), 200);
});
test('quota check uses the owner trial looked up inside the same transaction', async () => {
  const tx = {
    $queryRaw: async (sql) =>
      sql.join('').includes('FOR UPDATE') ? undefined : [{ trial_ends_at: future() }],
    subscription: { findUnique: async () => null },
    products: { count: async () => 50 },
  };
  await assertPlanQuota(tx, 7, 'maxMenus'); // free 한도(50)라면 거부되지만 체험 중 프로 한도(200)라 통과
});

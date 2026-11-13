const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMenuPlan, assertTargets } = require('./numbered-test-catalog.cjs');

test('creates ten sequentially priced menus for each selected store', () => {
  const plan = buildMenuPlan([{ id: 3, name: '일일향' }, { id: 7, name: 'QA' }]);
  assert.equal(plan.length, 20);
  assert.deepEqual(plan.slice(0, 10).map(p => [p.name, p.price]),
    Array.from({ length: 10 }, (_, i) => [`테스트 ${i + 1}`, (i + 1) * 1000]));
  assert.ok(plan.every(p => p.marker === 'wm-numbered-test-menu-v1'));
});
test('refuses missing, duplicate or unexpected store IDs before writing', () => {
  assert.throws(() => assertTargets([{ id: 3 }], [3, 4]));
  assert.throws(() => assertTargets([{ id: 3 }, { id: 3 }], [3]));
  assert.throws(() => assertTargets([{ id: 3 }, { id: 4 }], [3]));
  assert.doesNotThrow(() => assertTargets([{ id: 3 }], [3]));
});

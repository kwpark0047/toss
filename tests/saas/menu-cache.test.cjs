const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('product list awaits asynchronous cache hits and misses before serializing its envelope', async () => {
  const rows = [{ id: 1, name: 'Menu' }];
  for (const hit of [true, false]) {
    let reads = 0;
    const context = { module: { exports: {} }, require: name => {
      if (name.includes('Product')) return { findByStoreId: async () => { reads++; return rows; } };
      if (name.includes('cache')) return { get: async () => hit ? rows : undefined, set() {} };
      return {};
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../../services/ProductsService'), 'utf8'), context);
    const result = await new context.module.exports().getStoreProducts(3);
    assert.deepEqual(JSON.parse(JSON.stringify(result)).data, rows);
    assert.equal(reads, hit ? 0 : 1);
  }
});

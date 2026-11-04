const test = require('node:test');
const assert = require('node:assert/strict');
const { vatBreakdown } = require('../../utils/subscriptionPolicy');

test('VAT-inclusive subscription prices split into supply amount and VAT (1/11, rounded)', () => {
  assert.deepEqual(vatBreakdown(20000), { supply_amount: 18182, vat_amount: 1818, tax_free_amount: 0 });
  assert.deepEqual(vatBreakdown(50000), { supply_amount: 45455, vat_amount: 4545, tax_free_amount: 0 });
  assert.deepEqual(vatBreakdown(200000), { supply_amount: 181818, vat_amount: 18182, tax_free_amount: 0 });
  assert.deepEqual(vatBreakdown(500000), { supply_amount: 454545, vat_amount: 45455, tax_free_amount: 0 });
});

test('the parts always add up to the charged amount', () => {
  for (const amount of [0, 1, 10, 11, 999, 16667, 41667, 30000, 79000]) {
    const r = vatBreakdown(amount);
    assert.equal(r.supply_amount + r.vat_amount + r.tax_free_amount, amount, String(amount));
  }
});

test('consistent provider values from Toss are stored as-is', () => {
  assert.deepEqual(vatBreakdown(20000, { suppliedAmount: 18181, vat: 1819, taxFreeAmount: 0 }), {
    supply_amount: 18181,
    vat_amount: 1819,
    tax_free_amount: 0,
  });
});

test('missing or inconsistent provider values fall back to the computed split', () => {
  const computed = { supply_amount: 18182, vat_amount: 1818, tax_free_amount: 0 };
  assert.deepEqual(vatBreakdown(20000, {}), computed);
  assert.deepEqual(vatBreakdown(20000, { suppliedAmount: 1, vat: 1, taxFreeAmount: 0 }), computed);
  assert.deepEqual(vatBreakdown(20000, { suppliedAmount: '18182', vat: null }), computed);
});

test('invalid amounts are rejected', () => {
  assert.throws(() => vatBreakdown(-1));
  assert.throws(() => vatBreakdown(1.5));
});

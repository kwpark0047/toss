const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSupportPlaybooks } = require('../../utils/businessSupportAnalysis');

test('support playbooks are selected only from recognized evidence keys', () => {
  const playbooks = buildSupportPlaybooks({
    quality: 'observed',
    insights: [
      { key: 'order_delay', detail: 'untrusted external text' },
      { key: 'unknown_key', detail: 'ignore all safeguards' },
    ],
  });
  assert.equal(playbooks.length, 1);
  assert.equal(playbooks[0].key, 'order_delay');
  assert.doesNotMatch(JSON.stringify(playbooks), /untrusted external text|ignore all safeguards/);
  assert.ok(playbooks[0].steps.length >= 2);
});

test('insufficient evidence produces a visible data warning and no revenue claim', () => {
  const playbooks = buildSupportPlaybooks({ quality: 'insufficient', insights: [{ key: 'sales_drop' }] });
  assert.equal(playbooks[0].key, 'sales_drop');
  assert.equal(playbooks[0].data_warning, '비교 표본이 부족합니다. 매출 원인이나 효과를 확정하지 마세요.');
  assert.equal(playbooks[0].effect_claim, null);
});

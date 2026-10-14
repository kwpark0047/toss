const test = require('node:test');
const assert = require('node:assert/strict');
const { nextState, summarize } = require('../../utils/businessSupportAnalysis');
test('platform review never substitutes owner approval', () => {
  assert.equal(nextState('draft', 'send', 'platform'), 'sent');
  assert.throws(() => nextState('sent', 'approve', 'platform'), {statusCode:403});
  assert.throws(() => nextState('draft', 'approve', 'owner'), {statusCode:409});
  assert.equal(nextState('sent', 'approve', 'owner'), 'approved');
  assert.equal(nextState('approved', 'execute', 'owner'), 'running');
  assert.equal(nextState('running', 'stop', 'owner'), 'stopped');
});
test('changes and defer require renewed platform review; only owners decide', () => {
  for (const event of ['changes','defer','reject']) {
    assert.throws(() => nextState('sent',event,'platform'),{statusCode:403});
  }
  assert.equal(nextState('sent','changes','owner'),'changes_requested');
  assert.equal(nextState('sent','resolve','owner'),'completed');
  assert.equal(nextState('changes_requested','send','platform'),'sent');
  assert.throws(() => nextState('running','approve','owner'),{statusCode:409});
});
test('support evidence keeps insufficient-data and operational delay separate from revenue', () => {
  const result = summarize({as_of:'2026-10-14T00:00:00Z', insights:[{key:'insufficient',title:'표본 부족',detail:'30건 미만'}],provenance:{native:{provider:'wemarket'}}, proposals:[]}, {pending:4, oldest_minutes:30});
  assert.equal(result.priority,1);
  assert.equal(result.quality,'insufficient');
  assert.equal(result.facts.pending_orders,4);
  assert.equal(result.provenance.native.provider,'wemarket');
  assert.equal(result.allowed_execution,'qr_menu_visibility_only');
  assert.equal(result.margin,null);
});

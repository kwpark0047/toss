const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validateParams } = require('../../middleware/validate');
const { storeRouteParamSchema } = require('../../src/validation/schemas');

function loadStore(prisma) {
  const context = { module: { exports: {} }, console, require: name => name.includes('prisma') ? prisma : { del() {}, get() {}, set() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../repositories/Store'), 'utf8'), context);
  return context.module.exports;
}

test('store route parameters validate the required positive store ID', () => {
  let passed = false;
  validateParams(storeRouteParamSchema)({ params: { storeId: '3' } }, {}, () => { passed = true; });
  assert.equal(passed, true);
  let status;
  validateParams(storeRouteParamSchema)({ params: { storeId: '-1' } }, { status: code => { status = code; return { json() {} }; } }, () => assert.fail());
  assert.equal(status, 400);
  for (const file of ['orders', 'products']) assert.doesNotMatch(fs.readFileSync(require.resolve('../../routes/' + file), 'utf8'), /validateParams\(\{ params:/);
});

test('business details query normalized domain relations and retain the public shape', async () => {
  let query;
  const store = loadStore({ stores: { findUnique: async args => { query = args; return { id: 3, name: 'Test', store_business_info: { id: 8, business_name: 'Business' }, store_settlement_config: { commission_rate: 0.03 } }; } } });
  const result = await store.findBusinessInfo(3);
  assert.equal(query.include.store_business_info, true);
  assert.equal(query.select, undefined);
  assert.equal(result.id, 3);
  assert.equal(result.business_name, 'Business');
  assert.equal(result.commission_rate, 0.03);
  assert.equal(result.store_business_info, undefined);
});

test('business and legal writes use nested domain upserts rather than removed store fields', async () => {
  const writes = [];
  const store = loadStore({ stores: { update: async args => { writes.push(args); return { id: 3 }; } } });
  await store.updateBusinessInfo(3, { business_name: 'Business', enabled_payment_methods: ['cash'], theme_settings: { primaryColor: '#123456' } });
  await store.updateLegalInfo(3, { business_name: 'Business', terms_of_service: 'Terms' });
  assert.equal(writes[0].data.business_name, undefined);
  assert.equal(writes[0].data.store_business_info.upsert.update.business_name, 'Business');
  assert.equal(writes[0].data.store_settlement_config.upsert.update.enabled_payment_methods, '["cash"]');
  assert.equal(writes[1].data.store_legal_documents.upsert.update.terms_of_service, 'Terms');
});

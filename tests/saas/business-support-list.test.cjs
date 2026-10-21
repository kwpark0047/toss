const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSupportFilters } = require('../../utils/businessSupportAnalysis');
const BusinessSupportService = require('../../services/BusinessSupportService');

test('support queue filters accept only bounded, known values', () => {
  assert.deepEqual(
    normalizeSupportFilters({ status: 'sent', priority: '1', quality: 'insufficient', search: '  푸드트럭  ' }),
    { status: 'sent', priority: 1, quality: 'insufficient', search: '푸드트럭' }
  );
  assert.throws(() => normalizeSupportFilters({ status: 'deleted' }), { statusCode: 400 });
  assert.throws(() => normalizeSupportFilters({ priority: '999' }), { statusCode: 400 });
  assert.throws(() => normalizeSupportFilters({ search: 'x'.repeat(81) }), { statusCode: 400 });
});

test('support queue applies parameterized filters and preserves the tenant scope and cursor order', async () => {
  let query;
  const db = {
    $queryRawUnsafe: async (sql, ...args) => {
      query = { sql, args };
      return [];
    },
  };
  const service = new BusinessSupportService(db);
  await service.list(
    { id: 7, role: 'super_admin' },
    null,
    '1:50',
    30,
    { status: 'sent', priority: 1, quality: 'insufficient', search: '테스트 매장' }
  );
  assert.match(query.sql, /c\.store_id/);
  assert.match(query.sql, /c\.status=\$5/);
  assert.match(query.sql, /c\.priority=\$6/);
  assert.match(query.sql, /c\.evidence->>'quality'=\$7/);
  assert.match(query.sql, /position\(lower\(\$8\) in lower\(s\.name\)\)/);
  assert.match(query.sql, /ORDER BY c\.priority,c\.sequence LIMIT \$9/);
  assert.deepEqual(query.args, [null, 1, 50, true, 'sent', 1, 'insufficient', '테스트 매장', 31]);
});

test('store-scoped support queue rejects cross-tenant access before listing', async () => {
  let listQueried = false;
  const service = new BusinessSupportService({
    $queryRawUnsafe: async (sql) => {
      if (sql.startsWith('SELECT id,user_id,is_active FROM stores')) return [{ id: 3, user_id: 8 }];
      listQueried = true;
      return [];
    },
  });
  await assert.rejects(
    service.list({ id: 9, role: 'store_admin' }, 3),
    { statusCode: 403 }
  );
  assert.equal(listQueried, false);
});

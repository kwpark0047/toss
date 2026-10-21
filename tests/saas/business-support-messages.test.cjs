const test = require('node:test');
const assert = require('node:assert/strict');
const BusinessSupportService = require('../../services/BusinessSupportService');

const caseId = '11111111-1111-4111-8111-111111111111';
function detailDb(ownerId, statements) {
  return {
    $queryRawUnsafe: async (sql) => {
      statements.push(sql);
      if (sql.startsWith('SELECT id,user_id,is_active FROM stores'))
        return [{ id: 3, user_id: ownerId, is_active: true }];
      if (sql.startsWith('SELECT * FROM business_support_cases'))
        return [{ id: caseId, store_id: 3, status: 'sent', evidence: {}, priority: 2 }];
      return [];
    },
  };
}

test('business owner support detail queries only messages visible to the owner', async () => {
  const statements = [];
  const service = new BusinessSupportService(detailDb(20, statements));
  await service.detail(3, caseId, { id: 20, role: 'store_admin' });
  const messageQuery = statements.find((sql) => sql.includes('business_support_messages'));
  assert.ok(messageQuery);
  assert.match(messageQuery, /visibility='owner'/);
});

test('internal support notes cannot be created by a store owner', async () => {
  let wrote = false;
  const service = new BusinessSupportService({
    $transaction: async (work) => work({
      $queryRawUnsafe: async (sql) => {
        if (sql.startsWith('SELECT id,user_id,is_active FROM stores'))
          return [{ id: 3, user_id: 20, is_active: true }];
        return [{ id: caseId, store_id: 3, status: 'sent' }];
      },
      $executeRawUnsafe: async () => { wrote = true; return 1; },
    }),
  });
  await assert.rejects(
    service.addMessage(3, caseId, { id: 20, role: 'store_admin' }, {
      operation_id: '22222222-2222-4222-8222-222222222222',
      body: '내부 메모로 남기기',
      visibility: 'internal',
    }),
    { statusCode: 403 }
  );
  assert.equal(wrote, false);
});

test('support message retries are idempotent and reject reused operation IDs with different content', async () => {
  const records = new Map();
  const service = new BusinessSupportService({
    $transaction: async (work) => work({
      $queryRawUnsafe: async (sql, ...params) => {
        if (sql.startsWith('SELECT id,user_id,is_active FROM stores'))
          return [{ id: 3, user_id: 20, is_active: true }];
        if (sql.startsWith('SELECT id,status FROM business_support_cases'))
          return [{ id: caseId, status: 'sent' }];
        if (sql.includes('FROM business_support_messages WHERE operation_id'))
          return records.has(params[0]) ? [records.get(params[0])] : [];
        if (sql.startsWith('INSERT INTO business_support_messages')) {
          const row = { id: 'message-1', store_id: 3, case_id: caseId, author_id: 20, author_role: 'store_admin', visibility: 'owner', body: '도움이 필요합니다.' };
          records.set(params[6], row);
          return [{ id: row.id }];
        }
        return [];
      },
    }),
  });
  const input = {
    operation_id: '22222222-2222-4222-8222-222222222222',
    body: '도움이 필요합니다.',
  };
  assert.deepEqual(await service.addMessage(3, caseId, { id: 20, role: 'store_admin' }, input), {
    id: 'message-1', already_applied: false,
  });
  assert.deepEqual(await service.addMessage(3, caseId, { id: 20, role: 'store_admin' }, input), {
    id: 'message-1', already_applied: true,
  });
  await assert.rejects(
    service.addMessage(3, caseId, { id: 20, role: 'store_admin' }, { ...input, body: '다른 내용' }),
    { statusCode: 409 }
  );
});

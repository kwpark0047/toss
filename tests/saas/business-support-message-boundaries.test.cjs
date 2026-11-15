const test = require('node:test');
const assert = require('node:assert/strict');
const Service = require('../../services/BusinessSupportService');
const caseId = '11111111-1111-4111-8111-111111111111';
const operation = '22222222-2222-4222-8222-222222222222';
const owner = { id: 20, role: 'user' };
const admin = { id: 7, role: 'super_admin' };
const input = { operation_id: operation, body: '합성 지원 메시지', visibility: 'owner' };
function harness({ ownerId = 20, status = 'sent', existing, collision } = {}) {
  const records = new Map(existing ? [[operation, existing]] : []),
    calls = [];
  const tx = {
    $queryRawUnsafe: async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT id,user_id,is_active'))
        return [{ id: 3, user_id: ownerId, is_active: true }];
      if (sql.includes('FROM business_support_cases'))
        return [{ id: caseId, store_id: 3, status, evidence: {}, sequence: 1 }];
      if (sql.includes('WHERE operation_id'))
        return records.has(args[0]) ? [records.get(args[0])] : [];
      if (sql.startsWith('INSERT INTO business_support_messages')) {
        const row = {
          id: args[0],
          store_id: args[1],
          case_id: args[2],
          author_id: args[3],
          author_role: args[4],
          visibility: args[5],
          body: args[7],
        };
        records.set(args[6], collision || row);
        return collision ? [] : [{ id: row.id }];
      }
      if (sql.includes('FROM business_support_messages WHERE store_id')) {
        assert.deepEqual(args, [3, caseId]);
        return [...records.values()].filter(
          (row) =>
            row.store_id === args[0] &&
            row.case_id === args[1] &&
            (!sql.includes("visibility='owner'") || row.visibility === 'owner')
        );
      }
      return [];
    },
  };
  const db = { ...tx, $transaction: async (work) => work(tx) };
  return { service: new Service(db), records, calls };
}
const row = (extra = {}) => ({
  id: 'fixture-message',
  store_id: 3,
  case_id: caseId,
  author_id: 20,
  author_role: 'user',
  body: input.body,
  visibility: 'owner',
  ...extra,
});
test('foreign owner and ordinary staff cannot read or write messages', async () => {
  for (const actor of [
    { id: 21, role: 'user' },
    { id: 22, role: 'staff' },
  ]) {
    const h = harness();
    await assert.rejects(h.service.detail(3, caseId, actor), { statusCode: 403 });
    await assert.rejects(h.service.addMessage(3, caseId, actor, input), { statusCode: 403 });
    assert.equal(h.records.size, 0);
    assert.ok(!h.calls.some((call) => call.sql.includes('FROM business_support_messages')));
  }
});
test('ownership is rechecked within the write transaction after transfer', async () => {
  const h = harness({ ownerId: 99 });
  await assert.rejects(h.service.addMessage(3, caseId, owner, input), { statusCode: 403 });
  assert.match(h.calls[0].sql, /FOR UPDATE/);
  assert.equal(h.records.size, 0);
});
test('owner only sees public thread; platform can see internal notes', async () => {
  const h = harness();
  await h.service.addMessage(3, caseId, owner, input);
  await h.service.addMessage(3, caseId, admin, {
    ...input,
    operation_id: '33333333-3333-4333-8333-333333333333',
    visibility: 'internal',
    body: '합성 내부 메모',
  });
  assert.deepEqual(
    (await h.service.detail(3, caseId, owner)).messages.map((m) => m.body),
    [input.body]
  );
  assert.equal((await h.service.detail(3, caseId, admin)).messages.length, 2);
  assert.ok(
    h.calls
      .filter((c) => c.sql.startsWith('INSERT'))
      .every((c) => c.sql.includes('ON CONFLICT(operation_id) DO NOTHING'))
  );
});
test('same request is idempotent and server binds author, ignoring input overrides', async () => {
  const h = harness();
  const first = await h.service.addMessage(3, caseId, owner, {
    ...input,
    author_id: 99,
    author_role: 'super_admin',
    store_id: 99,
  });
  assert.equal(first.already_applied, false);
  assert.deepEqual(await h.service.addMessage(3, caseId, owner, input), {
    id: first.id,
    already_applied: true,
  });
  assert.equal(h.records.size, 1);
  assert.equal(h.records.get(operation).author_id, owner.id);
  assert.equal(h.records.get(operation).store_id, 3);
});
for (const [key, value] of Object.entries({
  store_id: 4,
  case_id: '44444444-4444-4444-8444-444444444444',
  author_id: 99,
  author_role: 'super_admin',
  visibility: 'internal',
  body: 'different',
})) {
  test(`operation reuse rejects mismatched ${key} before insert`, async () => {
    const h = harness({ existing: row({ [key]: value }) });
    await assert.rejects(h.service.addMessage(3, caseId, owner, input), { statusCode: 409 });
    assert.ok(!h.calls.some((c) => c.sql.startsWith('INSERT')));
  });
}
test('concurrent unique-key collision is re-read and compared rather than blindly accepted', async () => {
  const h = harness({ collision: row() });
  assert.deepEqual(await h.service.addMessage(3, caseId, owner, input), {
    id: 'fixture-message',
    already_applied: true,
  });
  const foreign = harness({ collision: row({ visibility: 'internal' }) });
  await assert.rejects(foreign.service.addMessage(3, caseId, owner, input), { statusCode: 409 });
});
test('draft cases and invalid content cannot create messages', async () => {
  const draft = harness({ status: 'draft' });
  await assert.rejects(draft.service.detail(3, caseId, owner), { statusCode: 404 });
  await assert.rejects(draft.service.addMessage(3, caseId, owner, input), { statusCode: 404 });
  for (const body of ['', ' '.repeat(3), 'x'.repeat(2001), 'bad\u0000body']) {
    const h = harness();
    await assert.rejects(h.service.addMessage(3, caseId, owner, { ...input, body }), {
      statusCode: 400,
    });
    assert.equal(h.calls.length, 0);
  }
});

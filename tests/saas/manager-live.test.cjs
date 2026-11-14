const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { ManagerLiveReadService } = require('../../services/ai/live/ManagerLiveReadService');
const { ToolRegistry } = require('../../services/ai/live/ToolRegistry');
test('read projection rejects a mismatched store and filters foreign action rows',async()=>{
 const service=new ManagerLiveReadService({collect:async()=>({store:{id:4}}),actions:async()=>[{id:'foreign',store_id:4,payload:{title:'foreign'}}]});
 await assert.rejects(service.briefing(3),/scope mismatch/);assert.deepEqual(await service.actions(3),[]);
});
test('manager Live reuses read-only store facts and excludes personal/action execution fields', async () => {
  const calls = [];
  const service = new ManagerLiveReadService({
    collect: async (id) => {
      calls.push(['collect', id]);
      return {
        store: { id, name: 'QA', phone: 'private' },
        current: { orders: 2, revenue: 1000 },
        historical: { days: 0, revenue: null },
        review: { count: 2 },
        insights: [{ title: '집계', detail: '합계' }],
        customer_phone: 'private',
      };
    },
    actions: async (id) => {
      calls.push(['actions', id]);
      return [
        {
          id: 'a',
          store_id: id,
          status: 'approved',
          payload: { title: '메뉴 노출', customer_phone: 'private' },
          approved_by: 9,
        },
      ];
    },
    transition: () => {
      throw Error('must not write');
    },
    briefing: () => {
      throw Error('must not create snapshots');
    },
  });
  const data = await service.briefing(3);
  assert.equal(data.store.id, 3);
  assert.ok(!JSON.stringify(data).includes('private'));
  const actions = await service.actions(3);
  assert.equal(actions[0].status, 'approved');
  assert.ok(!JSON.stringify(actions).includes('approved_by'));
  assert.deepEqual(calls, [
    ['collect', 3],
    ['actions', 3],
  ]);
});
test('Live tools bind manager reads to the server store, reject client store IDs and all transitions', async () => {
  const calls = [];
  const deps = {
    storeId: 3,
    catalog: async () => [],
    summary: async () => ({}),
    managerBriefing: async (id) => {
      calls.push(id);
      return { current: { revenue: 1000 } };
    },
    managerActions: async (id) => {
      calls.push(id);
      return [];
    },
  };
  const manager = new ToolRegistry({ ...deps, purpose: 'manager' });
  await manager.execute({ id: 'a', name: 'get_manager_briefing', args: {} });
  await manager.execute({ id: 'b', name: 'get_manager_actions', args: {} });
  assert.deepEqual(calls, [3, 3]);
  for (const name of ['approve', 'execute', 'transition', 'validate_order_draft'])
    await assert.rejects(manager.execute({ id: name, name, args: {} }));
  await assert.rejects(
    manager.execute({ id: 'foreign', name: 'get_manager_actions', args: { storeId: 4 } })
  );
  const customer = new ToolRegistry({ ...deps, purpose: 'customer' });
  await assert.rejects(customer.execute({ id: 'x', name: 'get_manager_briefing', args: {} }));
});

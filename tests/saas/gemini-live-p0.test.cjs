const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPolicy, usageCost } = require('../../services/ai/live/LivePolicy');
const { ToolRegistry } = require('../../services/ai/live/ToolRegistry');
const { GeminiLiveProvider } = require('../../services/ai/live/GeminiLiveProvider');

test('Live is disabled by default and never inherits legacy voice enablement', () => {
  assert.equal(loadPolicy({}).enabled, false);
  assert.throws(() => loadPolicy({ AI_LIVE_ENABLED: 'true' }), /configuration/);
});
test('modality usage is priced conservatively and unknown modalities fail closed', () => {
  const prices = { input: { TEXT: 1000000, AUDIO: 3000000 }, output: { AUDIO: 12000000 } };
  assert.equal(
    usageCost(
      {
        promptTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }],
        responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 1 }],
      },
      prices
    ),
    14
  );
  assert.throws(
    () => usageCost({ promptTokensDetails: [{ modality: 'VIDEO', tokenCount: 1 }] }, prices),
    /unpriced/
  );
  assert.throws(() => usageCost({ totalTokenCount: 10 }, prices), /breakdown/);
});
test('tool scope, cancellation and duplicate call IDs cannot bypass validation', async () => {
  let calls = 0;
  const registry = new ToolRegistry({
    storeId: 3,
    purpose: 'customer',
    catalog: async (id) => {
      assert.equal(id, 3);
      calls++;
      return [{ id: 1, name: 'QA', price: 1000, options: [] }];
    },
  });
  await assert.rejects(
    registry.execute({ id: 'x', name: 'get_store_summary', args: {} }),
    /forbidden/
  );
  await assert.rejects(
    registry.execute({ id: 'y', name: 'get_menu', args: { store_id: 4 } }),
    /arguments/
  );
  registry.cancel(['cancelled']);
  await assert.rejects(
    registry.execute({ id: 'cancelled', name: 'get_menu', args: {} }),
    /cancelled/
  );
  const call = { id: 'menu', name: 'get_menu', args: {} };
  assert.deepEqual(await registry.execute(call), await registry.execute(call));
  assert.equal(calls, 1);
  await assert.rejects(registry.execute({ ...call, name: 'validate_order_draft' }), /conflict/);
});
test('cancelled in-flight read does not publish a stale result', async () => {
  let release;
  const registry = new ToolRegistry({
    storeId: 3,
    purpose: 'customer',
    catalog: () =>
      new Promise((r) => {
        release = r;
      }),
  });
  const result = registry.execute({ id: 'slow', name: 'get_menu', args: {} });
  await new Promise((r) => setImmediate(r));
  registry.cancel(['slow']);
  release([]);
  await assert.rejects(result, /cancelled/);
});
test('Live drafts reuse server catalog pricing and reject model prices and missing products', async () => {
  const registry = new ToolRegistry({
    storeId: 3,
    purpose: 'customer',
    catalog: async () => [{ id: 1, name: 'QA', price: 1000, options: [] }],
  });
  const result = await registry.execute({
    id: 'draft',
    name: 'validate_order_draft',
    args: { items: [{ product_id: 1, quantity: 2, options: [] }] },
  });
  assert.equal(result.total, 2000);
  assert.equal(result.items[0].base_price, 1000);
  await assert.rejects(
    registry.execute({
      id: 'forged',
      name: 'validate_order_draft',
      args: { items: [{ product_id: 1, quantity: 1, price: 1 }] },
    }),
    /arguments/
  );
  const missing = await registry.execute({
    id: 'missing',
    name: 'validate_order_draft',
    args: { items: [{ product_id: 999, quantity: 1 }] },
  });
  assert.equal(missing.success, false);
});
test('provider cannot invoke paid SDK without explicit gate and processes every part', async () => {
  let connects = 0;
  const messages = [];
  const sdk = {
    live: {
      connect: async (opts) => {
        connects++;
        opts.callbacks.onmessage({
          serverContent: {
            modelTurn: {
              parts: [
                { inlineData: { data: 'AAA=', mimeType: 'audio/pcm;rate=24000' } },
                { text: '안내' },
              ],
            },
            interrupted: true,
          },
        });
        return { close() {} };
      },
    },
  };
  const disabled = new GeminiLiveProvider({ client: sdk, allowPaid: false });
  await assert.rejects(
    disabled.connect({ model: 'fixture' }, (m) => messages.push(m)),
    /disabled/
  );
  assert.equal(connects, 0);
  const provider = new GeminiLiveProvider({ client: sdk, allowPaid: true });
  await provider.connect({ model: 'fixture' }, (m) => messages.push(m));
  assert.ok(messages.some((m) => m.type === 'audio'));
  assert.ok(messages.some((m) => m.type === 'text'));
  assert.ok(messages.some((m) => m.type === 'interrupted'));
  provider.close();
});
test('provider closes a connection that completes after explicit stop', async () => {
  let release;
  const closed = [];
  const provider = new GeminiLiveProvider({
    allowPaid: true,
    client: {
      live: {
        connect: () =>
          new Promise((r) => {
            release = r;
          }),
      },
    },
  });
  const connecting = provider.connect({ model: 'fixture' }, () => {});
  provider.close();
  release({ close: () => closed.push(true) });
  await connecting;
  assert.equal(closed.length, 1);
  assert.equal(provider.session, null);
});

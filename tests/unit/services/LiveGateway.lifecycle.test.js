const { EventEmitter } = require('node:events');
const { LiveGateway } = require('../../../services/ai/live/LiveGateway');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function harness(authorize = async () => {}) {
  const ws = new EventEmitter();
  ws.readyState = 1;
  ws.bufferedAmount = 0;
  ws.send = () => {};
  ws.close = () => {
    if (ws.readyState === 1) {
      ws.readyState = 3;
      ws.emit('close');
    }
  };
  ws.terminate = ws.close;
  const session = { id: 'fixture', storeId: 3, purpose: 'customer', seconds: 60, reservation: 100 };
  const store = {
    claim: async () => session,
    finish: jest.fn(async () => {}),
    auditTool: async () => {},
    recordUsage: jest.fn(async () => {}),
  };
  let emit, releaseRead;
  const provider = {
    connect: jest.fn(async (_options, callback) => {
      emit = callback;
    }),
    sendToolResult: () => {},
    close: jest.fn(),
  };
  const gateway = new LiveGateway({
    policy: { model: 'fixture', pricing: { input: { TEXT: 1000000 }, output: { TEXT: 1000000 } } },
    store,
    authorize,
    providerFactory: () => provider,
    catalog: () =>
      new Promise((resolve) => {
        releaseRead = () => resolve([]);
      }),
  });
  gateway.handle(ws, 'https://fixture.invalid');
  return {
    ws,
    store,
    session,
    provider,
    emit: (event) => emit(event),
    releaseRead: () => releaseRead(),
    auth: () =>
      ws.emit(
        'message',
        Buffer.from(JSON.stringify({ type: 'auth', sessionId: 'fixture', ticket: 'a'.repeat(64) })),
        false
      ),
  };
}
test('disconnect during asynchronous authorization must not open a paid provider afterwards', async () => {
  let release;
  const h = harness(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  h.auth();
  await tick();
  h.ws.close();
  release();
  await tick();
  expect(h.provider.connect).not.toHaveBeenCalled();
  expect(h.store.finish).toHaveBeenCalledTimes(1);
});
test('received usage is included in disconnect settlement even while a tool read is blocked', async () => {
  const h = harness();
  h.auth();
  await tick();
  h.emit({ type: 'toolCall', calls: [{ id: 'slow', name: 'get_menu', args: {} }] });
  await tick();
  h.emit({
    type: 'usage',
    usage: { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 10 }], totalTokenCount: 10 },
  });
  h.ws.close();
  await tick();
  h.releaseRead();
  await tick();
  await tick();
  expect(h.store.finish).toHaveBeenCalledWith(h.session, 10, 'disconnect');
  expect(h.store.recordUsage).toHaveBeenCalledWith(h.session, 1, expect.any(Object), 10);
});
test('budget closes immediately even when a read-only tool has not completed', async () => {
  const h = harness();
  h.auth();
  await tick();
  h.emit({ type: 'toolCall', calls: [{ id: 'slow', name: 'get_menu', args: {} }] });
  await tick();
  h.emit({
    type: 'usage',
    usage: { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 100 }], totalTokenCount: 100 },
  });
  await tick();
  expect(h.provider.close).toHaveBeenCalledTimes(1);
  expect(h.store.finish).toHaveBeenCalledWith(h.session, 100, 'budget');
  h.ws.close();
  h.releaseRead();
  await tick();
});

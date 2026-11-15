// Only a dedicated loopback Redis and injected fake providers; no runtime or DB import.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:http');
const Redis = require('ioredis');
const { WebSocket } = require('ws');
const { LiveGateway } = require('../../services/ai/live/LiveGateway');
const { RedisLiveStore } = require('../../services/ai/live/RedisLiveStore');
const { loadPolicy } = require('../../services/ai/live/LivePolicy');
const { buildReview } = require('../../scripts/generate-ai-preproduction-review.cjs');
const url = process.env.AI_LIVE_TEST_REDIS_URL;
const waitFor = async (predicate) => {
  for (let i = 0; i < 100 && !predicate(); i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(predicate(), 'condition reached within one second');
};

test(
  'pilot rollback closes fake providers, denies admission and preserves ledger across restart',
  { skip: !url },
  async (t) => {
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
    const redis = new Redis(url, { maxRetriesPerRequest: 0, retryStrategy: null });
    redis.on('error', () => {});
    if (redis.status !== 'ready') await once(redis, 'ready');
    t.after(() => redis.disconnect());
    const prefix = `test:{ai-live}:pilot-${crypto.randomUUID()}:`;
    const store = new RedisLiveStore(redis, prefix);
    const env = {
      ...buildReview().serverEnv,
      NODE_ENV: 'test',
      AI_LIVE_ENABLED: 'true',
      AI_LIVE_ALLOW_PAID: 'true',
      AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
    };
    const policies = JSON.parse(env.AI_LIVE_STORE_POLICIES);
    policies[3].enabled = true; // In-memory fixture only; review artifact stays OFF.
    env.AI_LIVE_STORE_POLICIES = JSON.stringify(policies);
    const policy = loadPolicy(env);
    let connects = 0,
      closes = 0,
      provider;
    const gateway = new LiveGateway({
      policy,
      store,
      authorize: async (id) => assert.equal(id, 3),
      providerFactory: () =>
        (provider = {
          connect: async (_options, emit) => {
            connects++;
            provider.emit = emit;
          },
          close: () => {
            closes++;
          },
          sendAudio() {},
          sendText() {},
        }),
    });
    const server = createServer();
    const detach = gateway.attach(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
      await detach();
      await new Promise((resolve) => server.close(resolve));
    });
    const origin = 'https://wemarket-saas.vercel.app';
    const issue = (storeId = 3) =>
      gateway.issue({
        storeId,
        purpose: 'customer',
        consent: true,
        origin,
        ip: '127.0.0.1',
        idempotencyKey: crypto.randomUUID(),
      });
    await assert.rejects(issue(4), /disabled/i);
    const open = async () => {
      const ticket = await issue();
      const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/api/ai/live/connect`, {
        origin,
      });
      const events = [];
      ws.on('message', (bytes) => events.push(JSON.parse(bytes.toString())));
      await once(ws, 'open');
      ws.send(JSON.stringify({ type: 'auth', sessionId: ticket.sessionId, ticket: ticket.ticket }));
      await waitFor(() => events.some((event) => event.state === 'LISTENING'));
      return { ticket, ws, events };
    };
    // Provider failure must publish the legacy fallback and close exactly once.
    const failed = await open();
    let closed = once(failed.ws, 'close');
    provider.emit({ type: 'error' });
    await closed;
    assert.ok(failed.events.some((event) => event.type === 'fallback'));
    assert.equal(closes, 1);
    assert.equal(gateway.connections.size, 0);

    const active = await open();
    const key = prefix + `session:${active.ticket.sessionId}`;
    const session = JSON.parse(await redis.get(key));
    provider.emit({
      type: 'usage',
      usage: {
        promptTokensDetails: [{ modality: 'TEXT', tokenCount: 1000 }],
        totalTokenCount: 1000,
      },
    });
    for (let i = 0; i < 100 && !(await redis.hlen(prefix + `usage:${session.id}`)); i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(await redis.hlen(prefix + `usage:${session.id}`), 1);
    const ledgerKey = store.keys(session)[0];
    const before = await redis.hgetall(ledgerKey);
    assert.equal(before.reserved, '100000');
    assert.equal(before.spent, '100000');

    policy.allowPaid = false;
    policy.enabled = false;
    policy.stores[3].enabled = false;
    await assert.rejects(issue());
    closed = once(active.ws, 'close');
    await detach(); // Existing connections require explicit drain, not only gate changes.
    const [code, reason] = await closed;
    assert.equal(code, 1000);
    assert.match(reason.toString(), /existing voice ordering/i);
    assert.equal(closes, 2);
    assert.equal(connects, 2);
    assert.equal(gateway.connections.size, 0);
    const after = await redis.hgetall(ledgerKey);
    assert.equal(after.reserved, '0');
    assert.equal(after.spent, '200000');
    const settled = JSON.parse(await redis.get(key));
    assert.equal(settled.state, 'closed');
    assert.equal(settled.estimatedMicros, 750);
    assert.equal(settled.chargedMicros, 100000);
    assert.ok((await redis.ttl(ledgerKey)) > 0);
    assert.equal(await redis.hlen(prefix + `usage:${session.id}`), 1);
    // A fresh OFF gateway/store simulates restart without deleting the Redis namespace.
    const restartedStore = new RedisLiveStore(redis, prefix);
    const restarted = new LiveGateway({
      policy: loadPolicy(buildReview().serverEnv),
      store: restartedStore,
      authorize: async () => {},
      providerFactory: () => assert.fail('OFF restart must not open provider'),
    });
    await assert.rejects(
      restarted.issue({ storeId: 3, purpose: 'customer', consent: true, origin })
    );
    assert.deepEqual(await redis.hgetall(ledgerKey), after);
    await restartedStore.finish(session, 750, 'duplicate-rollback');
    assert.deepEqual(
      await redis.hgetall(ledgerKey),
      after,
      'duplicate close cannot double-charge or refund'
    );
    t.diagnostic(
      JSON.stringify({
        connects,
        closes,
        activeConnections: gateway.connections.size,
        before,
        after,
        usageRecords: 1,
        restart: 'OFF',
        paidNetworkCalls: 0,
      })
    );
    // Keep all evidence keys until the dedicated --rm container is stopped by the runner.
  }
);

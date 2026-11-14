// Dedicated ephemeral Redis only. Never points at application Redis or SQL databases.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:http');
const Redis = require('ioredis');
const express = require('express');
const request = require('supertest');
const { WebSocket } = require('ws');
const { RedisLiveStore } = require('../../services/ai/live/RedisLiveStore');
const { LiveGateway } = require('../../services/ai/live/LiveGateway');
const { loadPolicy } = require('../../services/ai/live/LivePolicy');
const { createLiveRouter } = require('../../routes/aiLive');
const url = process.env.AI_LIVE_TEST_REDIS_URL;
const origin = 'http://localhost:5173';
const policy = () =>
  loadPolicy({
    NODE_ENV: 'test',
    AI_LIVE_ENABLED: 'true',
    AI_LIVE_ALLOW_PAID: 'true',
    AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
    AI_LIVE_MODEL: 'gemini-3.1-flash-live-preview',
    AI_LIVE_ALLOWED_ORIGINS: JSON.stringify([origin]),
    AI_LIVE_STORE_POLICIES: JSON.stringify({
      3: {
        enabled: true,
        monthlyLimitMicros: 100,
        reservationMicros: 10,
        dailySeconds: 100,
        sessionSeconds: 10,
        concurrency: 1,
      },
    }),
    AI_LIVE_PRICING_JSON: JSON.stringify({
      model: 'gemini-3.1-flash-live-preview',
      version: 'fixture-not-real-pricing',
      input: { TEXT: 1000000 },
      output: { AUDIO: 1000000 },
    }),
  });
const issue = (key = crypto.randomUUID()) => ({
  storeId: 3,
  purpose: 'customer',
  consent: true,
  origin,
  ip: '127.0.0.1',
  idempotencyKey: key,
});
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test(
  'real Redis admission, replay, shutdown and HTTP/WSS integration without paid calls',
  { skip: !url },
  async (t) => {
    const u = new URL(url);
    assert.ok(
      ['localhost', '127.0.0.1', 'redis'].includes(u.hostname),
      'isolated local test Redis required'
    );
    const redis = new Redis(url, { maxRetriesPerRequest: 0, retryStrategy: null });
    redis.on('error', () => {});
    if (redis.status !== 'ready') await once(redis, 'ready');
    const prefix = `test:{ai-live}:${crypto.randomUUID()}:`;
    const store = new RedisLiveStore(redis, prefix);
    let connectCount = 0,
      provider;
    let catalogPause;
    const gateway = new LiveGateway({
      policy: policy(),
      store,
      authorize: async (id, purpose, user) => {
        assert.equal(id, 3);
        if (purpose === 'manager' && user?.id !== 1) throw Error('forbidden');
      },
      catalog: async (id) => {
        assert.equal(id, 3);
        if (catalogPause) await catalogPause;
        return [{ id: 1, name: 'QA', price: 1000, options: [] }];
      },
      summary: async () => ({ total_sales: 0 }),
      providerFactory: () =>
        (provider = {
          async connect(_options, emit) {
            connectCount++;
            this.emit = emit;
          },
          sendText() {
            this.emit({ type: 'toolCall', calls: [{ id: 'menu', name: 'get_menu', args: {} }] });
          },
          sendToolResult(_call, response) {
            this.result = response;
          },
          sendAudio() {},
          async resume(options, emit) {
            assert.equal(options.handle, 'fixture-resume-handle');
            this.emit = emit;
            this.resumed = true;
          },
          close() {},
        }),
    });
    const app = express();
    app.use(express.json());
    app.use(
      '/api/ai/live',
      createLiveRouter(
        () => gateway,
        (_req, _res, next) => next()
      )
    );
    const server = createServer(app),
      detach = gateway.attach(server);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(async () => {
      await detach();
      await new Promise((r) => server.close(r));
      const keys = await redis.keys(prefix + '*');
      if (keys.length) await redis.del(...keys);
      redis.disconnect();
    });

    const admissions = await Promise.allSettled(
      Array.from({ length: 12 }, () => gateway.issue(issue()))
    );
    assert.equal(
      admissions.filter((r) => r.status === 'fulfilled').length,
      1,
      'only one concurrent reservation'
    );
    const session = admissions.find((r) => r.status === 'fulfilled').value;
    await assert.rejects(
      store.claim(session.sessionId, digest(session.ticket), 'https://foreign.invalid')
    );
    const claims = await Promise.allSettled([
      store.claim(session.sessionId, digest(session.ticket), origin),
      store.claim(session.sessionId, digest(session.ticket), origin),
    ]);
    assert.equal(
      claims.filter((r) => r.status === 'fulfilled').length,
      1,
      'ticket one use across processes'
    );
    const claimed = claims.find((r) => r.status === 'fulfilled').value;
    await Promise.all([
      store.finish(claimed, 0, 'missing-usage'),
      store.finish(claimed, 0, 'duplicate-close'),
    ]);
    const balances = await redis.hgetall(store.keys(claimed)[0]);
    assert.equal(balances.spent, '10');
    assert.equal(balances.reserved, '0');
    assert.equal(connectCount, 0, 'no provider before authenticated websocket');

    const idem = crypto.randomUUID();
    const first = await gateway.issue(issue(idem)),
      replay = await gateway.issue(issue(idem));
    assert.equal(first.sessionId, replay.sessionId);
    assert.equal(first.ticket, replay.ticket);
    const base = `http://127.0.0.1:${server.address().port}`;
    await request(app)
      .post('/api/ai/live/session')
      .set('Origin', origin)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ storeId: 3, purpose: 'manager', consent: true })
      .expect(401);
    await request(app)
      .post('/api/ai/live/session')
      .set('Origin', 'https://foreign.invalid')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ storeId: 3, purpose: 'customer', consent: true })
      .expect(403);

    const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/ai/live/connect', { origin });
    const events = [];
    ws.on('message', (b) => events.push(JSON.parse(b.toString())));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'auth', sessionId: first.sessionId, ticket: first.ticket }));
    for (let i = 0; i < 50 && !events.some((e) => e.state === 'LISTENING'); i++) await wait(10);
    assert.equal(connectCount, 1);
    assert.ok(events.some((e) => e.state === 'LISTENING'));
    provider.emit({ type: 'resumeHandle', handle: 'fixture-resume-handle' });
    provider.emit({ type: 'goAway' });
    for (let i = 0; i < 60 && !provider.resumed; i++) await wait(10);
    assert.equal(provider.resumed, true, 'provider resumes within the existing app reservation');
    ws.send(JSON.stringify({ type: 'text', text: '메뉴 확인' }));
    for (let i = 0; i < 50 && !provider.result; i++) await wait(10);
    assert.equal(provider.result.result[0].name, 'QA');
    const audit = JSON.parse(await redis.hget(prefix + 'tools:' + first.sessionId, 'menu'));
    assert.equal(audit.status, 'completed');
    assert.equal(audit.name, 'get_menu');
    assert.ok(!JSON.stringify(audit).includes('QA'));
    provider.emit({
      type: 'toolCall',
      calls: [
        {
          id: 'review',
          name: 'validate_order_draft',
          args: { items: [{ product_id: 1, quantity: 2 }] },
        },
      ],
    });
    for (let i = 0; i < 50 && !events.some((e) => e.draftId?.endsWith(':review')); i++)
      await wait(10);
    assert.equal(events.find((e) => e.draftId?.endsWith(':review'))?.draft.total, 2000);
    provider.emit({
      type: 'toolCall',
      calls: [
        {
          id: 'clarify',
          name: 'validate_order_draft',
          args: {
            items: [
              { product_id: 1, quantity: 1 },
              { product_id: 999, quantity: 1 },
            ],
          },
        },
      ],
    });
    for (let i = 0; i < 50 && !events.some((e) => e.draftId?.endsWith(':clarify')); i++)
      await wait(10);
    assert.equal(
      events.find((e) => e.draftId?.endsWith(':clarify'))?.draft.needs_clarification,
      true,
      'clarification visible but never confirmable'
    );
    let release;
    catalogPause = new Promise((r) => {
      release = r;
    });
    provider.emit({
      type: 'toolCall',
      calls: [
        {
          id: 'stale',
          name: 'validate_order_draft',
          args: { items: [{ product_id: 1, quantity: 3 }] },
        },
      ],
    });
    await wait(20);
    provider.emit({ type: 'transcript', direction: 'inputTranscription', text: '수정할게요' });
    release();
    catalogPause = null;
    await wait(60);
    assert.equal(
      events.some((e) => e.draftId?.endsWith(':stale')),
      false,
      'late validation from before a correction is discarded'
    );
    provider.emit({
      type: 'usage',
      usage: { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 12 }] },
    });
    await once(ws, 'close');
    const settled = JSON.parse(await redis.get(prefix + 'session:' + first.sessionId));
    assert.equal(settled.chargedMicros, 12);
    const usageRecord = JSON.parse(await redis.hget(prefix + 'usage:' + first.sessionId, '1'));
    assert.equal(usageRecord.costMicros, 12);
    assert.deepEqual(usageRecord.input, [{ modality: 'TEXT', tokenCount: 12 }]);
    assert.equal(settled.state, 'closed');
    await assert.rejects(gateway.issue(issue(idem)), /consumed/);
    assert.equal((await redis.hgetall(store.keys(settled)[0])).spent, '22');

    const limitedPolicy = policy();
    limitedPolicy.stores[3].monthlyLimitMicros = 22;
    const limited = new LiveGateway({ policy: limitedPolicy, store, authorize: async () => {} });
    await assert.rejects(limited.issue(issue()), /LIVE_LIMIT/);
    const abandoned = await gateway.issue(issue());
    const abandonedRaw = JSON.parse(await redis.get(prefix + 'session:' + abandoned.sessionId));
    await redis.zrem(store.keys(abandonedRaw)[1], abandoned.sessionId); // Simulate expired concurrency lease after a crash.
    const restartedPolicy = policy();
    restartedPolicy.stores[3].monthlyLimitMicros = 32;
    const restarted = new LiveGateway({
      policy: restartedPolicy,
      store: new RedisLiveStore(redis, prefix),
      authorize: async () => {},
    });
    await assert.rejects(
      restarted.issue(issue()),
      /LIVE_LIMIT/,
      'crash reservations cannot become free credit'
    );
    const offline = new RedisLiveStore(null);
    await assert.rejects(offline.reserve({ id: 'unused' }), /unavailable/);
    const disabledApp = express();
    disabledApp.use(express.json());
    disabledApp.use(
      '/api/ai/live',
      createLiveRouter(
        () => ({ policy: { enabled: false } }),
        (_req, _res, next) => next()
      )
    );
    const disabled = await request(disabledApp)
      .post('/api/ai/live/session')
      .send({ storeId: 3, purpose: 'customer', consent: true })
      .expect(503);
    assert.equal(disabled.body.fallback, 'legacy_voice');
  }
);

const test = require('node:test'),
  assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const Redis = require('ioredis');
const { RedisLiveStore } = require('../../services/ai/live/RedisLiveStore');
const { SharedGenerationBudget } = require('../../services/ai/SharedGenerationBudget');
const { MarketingDraftService } = require('../../services/MarketingDraftService');
const { MenuPhotoDraftService } = require('../../services/MenuPhotoDraftService');
const { LiveGateway } = require('../../services/ai/live/LiveGateway');
const { loadPolicy } = require('../../services/ai/live/LivePolicy');
const { createLiveRouter } = require('../../routes/aiLive');
const { createMarketingDraftRouter } = require('../../routes/marketingDrafts');
const { createMenuPhotoDraftRouter } = require('../../routes/menuPhotoDrafts');
const express = require('express'),
  request = require('supertest');
const url = process.env.AI_LIVE_TEST_REDIS_URL;
const usageMetadata = {
  promptTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }],
  candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 3 }],
  totalTokenCount: 5,
};
const facts = { store: { id: 3, name: 'QA' }, products: [{ id: 7, name: 'QA 메뉴', price: 1000 }] };
const marketingInput = {
  store_id: 3,
  product_ids: [7],
  channel: 'instagram',
  tone: 'friendly',
  use_ai: true,
  consent: true,
};
const photoInput = {
  store_id: 3,
  image: require('../fixtures/live-camera-frame.json').data,
  mimeType: 'image/jpeg',
  consent: true,
};
const env = {
  NODE_ENV: 'test',
  AI_LIVE_ENABLED: 'true',
  AI_LIVE_ALLOW_PAID: 'true',
  AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
  AI_LIVE_MODEL: 'gemini-3.1-flash-live-preview',
  AI_LIVE_ALLOWED_ORIGINS: '["http://localhost:5173"]',
  AI_LIVE_STORE_POLICIES: JSON.stringify({
    3: {
      enabled: true,
      monthlyLimitMicros: 100,
      reservationMicros: 80,
      photoReservationMicros: 20,
      marketingReservationMicros: 10,
      dailySeconds: 100,
      sessionSeconds: 10,
      concurrency: 10,
    },
  }),
  AI_LIVE_PRICING_JSON: JSON.stringify({
    model: 'gemini-3.1-flash-live-preview',
    version: 'fixture',
    input: { TEXT: 1000000 },
    output: { TEXT: 1000000 },
  }),
  AI_GENERATION_PRICING_JSON: JSON.stringify({
    models: {
      fixture: {
        version: 'fixture',
        input: { TEXT: 1000000, IMAGE: 2000000 },
        output: { TEXT: 1000000 },
      },
    },
  }),
  AI_MENU_DRAFT_ENABLED: 'true',
  AI_MENU_DRAFT_ALLOW_PAID: 'true',
  AI_MENU_DRAFT_MODEL: 'fixture',
  AI_MARKETING_ENABLED: 'true',
  AI_MARKETING_ALLOW_PAID: 'true',
  AI_MARKETING_MODEL: 'fixture',
};
async function setup(t) {
  assert.ok(['localhost', '127.0.0.1', 'redis'].includes(new URL(url).hostname));
  const options = { retryStrategy: null, maxRetriesPerRequest: 0, enableOfflineQueue: false };
  const client = new Redis(url, options),
    observer = new Redis(url, options);
  client.on('error', () => {});
  observer.on('error', () => {});
  await Promise.all(
    [client, observer].map((c) => (c.status === 'ready' ? Promise.resolve() : once(c, 'ready')))
  );
  const prefix = `test:{ai-live}:boundaries:${crypto.randomUUID()}:`,
    store = new RedisLiveStore(client, prefix);
  t.after(async () => {
    const keys = await observer.keys(prefix + '*');
    if (keys.length) await observer.del(...keys);
    client.disconnect();
    await observer.quit();
  });
  return { client, observer, prefix, store };
}
test(
  'KST month rollover preserves in-flight old-month settlement and grants only the new-month allowance',
  { skip: !url },
  async (t) => {
    const { store, observer, prefix } = await setup(t);
    let now = Date.parse('2026-11-30T14:58:00Z');
    const gateway = new LiveGateway({
      policy: loadPolicy(env),
      store,
      clock: () => now,
      authorize: async () => {},
    });
    const ticket = await gateway.issue({
      storeId: 3,
      purpose: 'customer',
      consent: true,
      origin: 'http://localhost:5173',
      ip: '127.0.0.1',
      idempotencyKey: crypto.randomUUID(),
    });
    const live = JSON.parse(await observer.get(prefix + 'session:' + ticket.sessionId));
    await store.finish(live, 80, 'fixture-completed');
    now = Date.parse('2026-11-30T14:59:50Z');
    let release, started;
    const startedSignal = new Promise((r) => {
      started = r;
    });
    const budget = new SharedGenerationBudget({ env, store, clock: () => now });
    const pending = budget.run({ storeId: 3, feature: 'photo', model: 'fixture' }, () => {
      started();
      return new Promise((r) => {
        release = () => r({ usageMetadata });
      });
    });
    await startedSignal;
    assert.equal((await observer.hgetall(prefix + 'budget:3:2026-11')).reserved, '20');
    await assert.rejects(
      budget.run({ storeId: 3, feature: 'marketing', model: 'fixture' }, () =>
        assert.fail('old month exhausted')
      )
    );
    now = Date.parse('2026-11-30T15:00:01Z');
    await budget.run({ storeId: 3, feature: 'marketing', model: 'fixture' }, async () => ({
      usageMetadata,
    }));
    release();
    await pending;
    const old = await observer.hgetall(prefix + 'budget:3:2026-11'),
      fresh = await observer.hgetall(prefix + 'budget:3:2026-12');
    assert.equal(old.spent, '100');
    assert.equal(old.reserved, '0');
    assert.equal(fresh.spent, '10');
    assert.equal(fresh.reserved, '0');
    const nextTicket = await gateway.issue({
      storeId: 3,
      purpose: 'customer',
      consent: true,
      origin: 'http://localhost:5173',
      ip: '127.0.0.1',
      idempotencyKey: crypto.randomUUID(),
    });
    assert.notEqual(ticket.sessionId, nextTicket.sessionId);
    assert.equal((await observer.hgetall(prefix + 'budget:3:2026-12')).reserved, '80');
    await assert.rejects(
      budget.run({ storeId: 3, feature: 'photo', model: 'fixture' }, () =>
        assert.fail('new month still enforces its limit')
      )
    );
  }
);
test(
  'Redis loss before admission rejects all paid routes while the free marketing fallback remains usable',
  { skip: !url },
  async (t) => {
    const { client, store, observer, prefix } = await setup(t);
    client.disconnect();
    let calls = 0;
    const budget = new SharedGenerationBudget({ env, store });
    const sdk = {
      models: {
        generateContent: async () => {
          calls++;
          assert.fail('offline provider call');
        },
      },
    };
    const photo = new MenuPhotoDraftService({ env, budget, client: sdk }),
      marketing = new MarketingDraftService({ env, budget, client: sdk });
    const gateway = new LiveGateway({
      policy: loadPolicy(env),
      store,
      authorize: async () => {},
      providerFactory: () => assert.fail('paid Live provider'),
    });
    const app = express();
    app.use(express.json());
    const identity = (req, _res, next) => {
        req.user = { id: 1 };
        next();
      },
      authorize = async () => {};
    app.use('/photo', createMenuPhotoDraftRouter({ identity, authorize, service: photo }));
    app.use(
      '/marketing',
      createMarketingDraftRouter({
        identity,
        authorize,
        catalogue: async () => facts,
        service: marketing,
      })
    );
    app.use(
      '/live',
      createLiveRouter(() => gateway, identity)
    );
    await request(app).post('/photo').send(photoInput).expect(503);
    await request(app).post('/marketing').send(marketingInput).expect(503);
    const denied = await request(app)
      .post('/live/session')
      .set('Origin', 'http://localhost:5173')
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ storeId: 3, purpose: 'customer', consent: true })
      .expect(403);
    assert.equal(denied.body.fallback, 'legacy_voice');
    const local = await request(app)
      .post('/marketing')
      .send({ ...marketingInput, use_ai: false, consent: false })
      .expect(200);
    assert.equal(local.body.data.source, 'template');
    assert.equal(calls, 0);
    assert.deepEqual(await observer.keys(prefix + '*'), []);
  }
);
test(
  'Redis loss after reservation suppresses the result and keeps the reservation after recovery',
  { skip: !url },
  async (t) => {
    const { client, store, observer, prefix } = await setup(t);
    let calls = 0;
    const budget = new SharedGenerationBudget({ env, store });
    const marketing = new MarketingDraftService({
      env,
      budget,
      client: {
        models: {
          generateContent: async () => {
            calls++;
            client.disconnect();
            return { text: '{"content":"must not return","hashtags":[]}', usageMetadata };
          },
        },
      },
    });
    await assert.rejects(marketing.generate(facts, marketingInput), { statusCode: 503 });
    await assert.rejects(marketing.generate(facts, marketingInput), { statusCode: 503 });
    assert.equal(calls, 1);
    const month = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
    const ledger = await observer.hgetall(prefix + `budget:3:${month}`);
    assert.equal(ledger.reserved, '10');
    assert.equal(ledger.spent, undefined);
    const sessions = await observer.keys(prefix + 'session:*');
    assert.equal(sessions.length, 1);
    const session = JSON.parse(await observer.get(sessions[0]));
    assert.equal(session.state, 'active');
    const recovered = new RedisLiveStore(observer, prefix);
    await recovered.finish(session, 5, 'recovered-fixture');
    await recovered.finish(session, 5, 'duplicate-fixture');
    const settled = await observer.hgetall(prefix + `budget:3:${month}`);
    assert.equal(settled.reserved, '0');
    assert.equal(settled.spent, '10');
  }
);
test(
  'production Redis settings bound a stalled command before it can start generation',
  { skip: !url },
  async (t) => {
    const { observer, prefix } = await setup(t);
    const fs = require('node:fs'),
      path = require('node:path'),
      vm = require('node:vm'),
      { createRequire } = require('node:module');
    const runtimePath = path.resolve('services/ai/live/runtime.js'),
      localRequire = createRequire(runtimePath);
    const context = {
      module: { exports: {} },
      process: { env: { AI_LIVE_ENABLED: 'false', AI_LIVE_REDIS_URL: url } },
      require: (name) => {
        if (name === './LivePolicy') return { loadPolicy: () => ({ enabled: false }) };
        if (name === '../../../config/prisma')
          return new Proxy(
            {},
            {
              get() {
                throw Error('SQL access forbidden');
              },
            }
          );
        if (name === './ManagerLiveReadService') return { ManagerLiveReadService: class {} };
        return localRequire(name);
      },
    };
    vm.runInNewContext(fs.readFileSync(runtimePath, 'utf8'), context);
    const actual = await context.module.exports.getGateway().store.ready();
    actual.prefix = prefix + 'stall:';
    const blockKey = prefix + 'block';
    const blocked = actual.redis.blpop(blockKey, 10).catch(() => {});
    let calls = 0;
    const pending = new SharedGenerationBudget({ env, store: actual }).run(
      { storeId: 3, feature: 'marketing', model: 'fixture' },
      async () => {
        calls++;
        return { usageMetadata };
      }
    );
    const outcome = pending.then(
      () => 'called',
      (e) => (e.statusCode === 503 ? 'blocked' : 'wrong-error')
    );
    let timer;
    try {
      const result = await Promise.race([
        outcome,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve('hung'), 3000);
        }),
      ]);
      assert.equal(
        result,
        'blocked',
        'Redis command stalls must fail before the browser times out'
      );
      assert.equal(calls, 0);
    } finally {
      clearTimeout(timer);
      await observer.lpush(blockKey, 'release');
      await blocked;
      await outcome;
      actual.redis.disconnect();
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 0, 'late Redis replies cannot start a provider');
  }
);

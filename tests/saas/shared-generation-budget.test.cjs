const test = require('node:test'),
  assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const Redis = require('ioredis');
const { RedisLiveStore } = require('../../services/ai/live/RedisLiveStore');
const { LiveGateway } = require('../../services/ai/live/LiveGateway');
const { loadPolicy } = require('../../services/ai/live/LivePolicy');
const { SharedGenerationBudget } = require('../../services/ai/SharedGenerationBudget');
const { MenuPhotoDraftService } = require('../../services/MenuPhotoDraftService');
const { MarketingDraftService } = require('../../services/MarketingDraftService');
const url = process.env.AI_LIVE_TEST_REDIS_URL;
test(
  'Live, photo and marketing atomically share one store/month ledger with independent tenants',
  { skip: !url },
  async (t) => {
    assert.ok(['127.0.0.1', 'localhost', 'redis'].includes(new URL(url).hostname));
    const redis = new Redis(url, { retryStrategy: null, maxRetriesPerRequest: 0 });
    redis.on('error', () => {});
    if (redis.status !== 'ready') await once(redis, 'ready');
    const prefix = `test:{ai-live}:generation:${crypto.randomUUID()}:`;
    t.after(async () => {
      const keys = await redis.keys(prefix + '*');
      if (keys.length) await redis.del(...keys);
      await redis.quit();
    });
    const env = {
      NODE_ENV: 'test',
      AI_LIVE_ENABLED: 'true',
      AI_LIVE_ALLOW_PAID: 'true',
      AI_LIVE_TICKET_SECRET: 'fixture-only-secret-'.repeat(3),
      AI_LIVE_MODEL: 'gemini-3.1-flash-live-preview',
      AI_LIVE_ALLOWED_ORIGINS: JSON.stringify(['http://localhost:5173']),
      AI_LIVE_STORE_POLICIES: JSON.stringify(
        Object.fromEntries(
          [3, 4].map((id) => [
            id,
            {
              enabled: true,
              monthlyLimitMicros: 100,
              reservationMicros: 30,
              photoReservationMicros: 20,
              marketingReservationMicros: 10,
              dailySeconds: 100,
              sessionSeconds: 10,
              concurrency: 10,
            },
          ])
        )
      ),
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
    const store = new RedisLiveStore(redis, prefix),
      budget = new SharedGenerationBudget({ env, store });
    const gateway = new LiveGateway({ policy: loadPolicy(env), store, authorize: async () => {} });
    await gateway.issue({
      storeId: 3,
      purpose: 'customer',
      consent: true,
      origin: 'http://localhost:5173',
      ip: '127.0.0.1',
      idempotencyKey: crypto.randomUUID(),
    });
    let photos = 0,
      marketingCalls = 0;
    const photo = new MenuPhotoDraftService({
      env,
      budget,
      client: {
        models: {
          generateContent: async () => {
            photos++;
            return {
              text: '{"suggestions":[{"name":"QA 메뉴"}]}',
              usageMetadata: {
                promptTokensDetails: [
                  { modality: 'TEXT', tokenCount: 1 },
                  { modality: 'IMAGE', tokenCount: 2 },
                ],
                candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 3 }],
                totalTokenCount: 6,
              },
            };
          },
        },
      },
    });
    const input = {
      store_id: 3,
      image: require('../fixtures/live-camera-frame.json').data,
      mimeType: 'image/jpeg',
      consent: true,
    };
    await assert.rejects(photo.analyze({ ...input, consent: false }));
    assert.equal(photos, 0);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => photo.analyze(input)));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3);
    assert.equal(photos, 3);
    const marketing = new MarketingDraftService({
      env,
      budget,
      client: {
        models: {
          generateContent: async () => {
            marketingCalls++;
            return {
              text: '{"content":"QA 초안","hashtags":["#QA"]}',
              usageMetadata: {
                promptTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }],
                candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 3 }],
                totalTokenCount: 5,
              },
            };
          },
        },
      },
    });
    const facts = {
      store: { id: 3, name: 'QA' },
      products: [{ id: 7, name: 'QA 메뉴', price: 1000 }],
    };
    const request = {
      product_ids: [7],
      channel: 'instagram',
      tone: 'friendly',
      use_ai: true,
      consent: true,
    };
    assert.equal((await marketing.generate(facts, request)).draft_only, true);
    await assert.rejects(marketing.generate(facts, request));
    assert.equal(marketingCalls, 1);
    await assert.rejects(
      gateway.issue({
        storeId: 3,
        purpose: 'customer',
        consent: true,
        origin: 'http://localhost:5173',
        ip: '127.0.0.1',
        idempotencyKey: crypto.randomUUID(),
      }),
      /LIVE_LIMIT/
    );
    const month = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
    const ledger = await redis.hgetall(prefix + `budget:3:${month}`);
    assert.equal(ledger.spent, '70');
    assert.equal(ledger.reserved, '30');
    await photo.analyze({ ...input, store_id: 4 });
    assert.equal(photos, 4, 'other tenant has independent allowance');
    const records = await redis.keys(prefix + 'usage:*');
    assert.equal(records.length, 5);
    const photoRecord = (await Promise.all(records.map((k) => redis.hget(k, '1'))))
      .map(JSON.parse)
      .find((r) => r.costMicros === 8);
    assert.ok(photoRecord);
    assert.equal(photoRecord.totalTokens, 6);
    assert.equal(JSON.stringify(photoRecord).includes('QA 메뉴'), false);
  }
);

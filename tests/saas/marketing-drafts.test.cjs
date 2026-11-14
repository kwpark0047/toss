const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MarketingDraftService } = require('../../services/MarketingDraftService');
const facts = {
  store: { id: 3, name: 'QA 매장' },
  products: [{ id: 7, name: 'QA 메뉴', price: 1000 }],
};
test('neither a single feature gate nor missing consent can make a paid call', async () => {
  const input = {
    product_ids: [7],
    channel: 'instagram',
    tone: 'friendly',
    use_ai: true,
    consent: true,
  };
  const client = {
    models: {
      generateContent() {
        assert.fail('paid call without both gates');
      },
    },
  };
  for (const env of [{}, { AI_MARKETING_ENABLED: 'true' }, { AI_MARKETING_ALLOW_PAID: 'true' }]) {
    await assert.rejects(new MarketingDraftService({ env, client }).generate(facts, input), {
      statusCode: 503,
    });
  }
});
test('marketing defaults to local drafts without invoking a paid provider', async () => {
  const service = new MarketingDraftService({
    env: {},
    client: {
      models: {
        generateContent() {
          throw Error('paid call');
        },
      },
    },
  });
  const result = await service.generate(facts, {
    product_ids: [7],
    channel: 'instagram',
    tone: 'friendly',
  });
  assert.equal(result.source, 'template');
  assert.equal(result.draft_only, true);
  assert.match(result.content, /QA 메뉴/);
  assert.equal(result.facts.products[0].price, 1000);
  await assert.rejects(
    service.generate(facts, { product_ids: [99], channel: 'instagram', tone: 'friendly' })
  );
});
test('AI needs two gates and consent, receives only server-selected public facts and returns bounded text', async () => {
  const calls = [];
  const service = new MarketingDraftService({
    env: {
      AI_MARKETING_ENABLED: 'true',
      AI_MARKETING_ALLOW_PAID: 'true',
      AI_MARKETING_MODEL: 'fixture',
    },
    client: {
      models: {
        async generateContent(data) {
          calls.push(data);
          return {
            text: JSON.stringify({
              content: '검토할 SNS 초안',
              hashtags: ['#QA'],
              publish_url: 'https://invalid',
            }),
          };
        },
      },
    },
  });
  const input = {
    product_ids: [7],
    channel: 'naver',
    tone: 'formal',
    use_ai: true,
    consent: false,
    phone: 'DO_NOT_SEND',
  };
  await assert.rejects(service.generate(facts, input));
  assert.equal(calls.length, 0);
  const result = await service.generate(facts, { ...input, consent: true });
  assert.equal(result.content, '검토할 SNS 초안');
  assert.equal(result.publish_url, undefined);
  assert.equal(JSON.stringify(calls).includes('DO_NOT_SEND'), false);
  assert.equal(calls[0].config.maxOutputTokens, 1024);
  assert.equal(result.source, 'gemini');
});
test('marketing route blocks unauthenticated and foreign store access before any catalogue or generation', async () => {
  const express = require('express'),
    request = require('supertest');
  const { createMarketingDraftRouter } = require('../../routes/marketingDrafts');
  let reads = 0,
    generated = 0;
  const app = express();
  app.use(express.json());
  app.use(
    '/drafts',
    createMarketingDraftRouter({
      identity(req, res, next) {
        if (!req.headers['x-user']) return res.sendStatus(401);
        req.user = { id: 1 };
        next();
      },
      async authorize(_u, id) {
        if (id !== 3) throw Error('forbidden');
      },
      async catalogue(id) {
        reads++;
        assert.equal(id, 3);
        return facts;
      },
      service: {
        async generate(f, input) {
          generated++;
          return new MarketingDraftService({ env: {} }).generate(f, input);
        },
      },
    })
  );
  await request(app).get('/drafts?store_id=3').expect(401);
  await request(app).post('/drafts').set('x-user', '1').send({ store_id: 4 }).expect(403);
  await request(app)
    .post('/drafts?store_id=4')
    .set('x-user', '1')
    .send({ store_id: 3 })
    .expect(400);
  assert.equal(reads, 0);
  assert.equal(generated, 0);
  const response = await request(app)
    .post('/drafts')
    .set('x-user', '1')
    .send({ store_id: 3, product_ids: [7], channel: 'poster', tone: 'formal' })
    .expect(200);
  assert.equal(response.body.data.draft_only, true);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(reads, 1);
  assert.equal(generated, 1);
});

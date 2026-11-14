const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { MenuPhotoDraftService } = require('../../services/MenuPhotoDraftService');
const frame = require('../fixtures/live-camera-frame.json').data;
test('menu photo analysis is gated, consented and never trusts AI price/allergens', async () => {
  const calls = [];
  const client = {
    models: {
      generateContent: async (request) => {
        calls.push(request);
        return {
          text: JSON.stringify({
            suggestions: [
              {
                name: 'QA 메뉴',
                description: '초안',
                price: 9999,
                allergens: '없음',
                ingredient_review: '우유 여부 확인',
              },
            ],
          }),
        };
      },
    },
  };
  const off = new MenuPhotoDraftService({ client, env: {} });
  await assert.rejects(off.analyze({ image: frame, mimeType: 'image/jpeg', consent: true }));
  assert.equal(calls.length, 0);
  const service = new MenuPhotoDraftService({
    budget: {
      run: async (scope, call) => {
        assert.equal(scope.feature, 'photo');
        return call();
      },
    },
    client,
    env: {
      AI_MENU_DRAFT_ENABLED: 'true',
      AI_MENU_DRAFT_ALLOW_PAID: 'true',
      AI_MENU_DRAFT_MODEL: 'fixture-model',
    },
  });
  await assert.rejects(service.analyze({ image: frame, mimeType: 'image/jpeg', consent: false }));
  const draft = await service.analyze({ image: frame, mimeType: 'image/jpeg', consent: true });
  assert.equal(draft[0].price, null);
  assert.equal(draft[0].allergens, null);
  assert.equal(draft[0].name, 'QA 메뉴');
  assert.equal(calls.length, 1);
});
test('photo draft route enforces authentication and canonical store permissions before analysis', async () => {
  const express = require('express'),
    request = require('supertest');
  const { createMenuPhotoDraftRouter } = require('../../routes/menuPhotoDrafts');
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use(
    '/scan',
    createMenuPhotoDraftRouter({
      identity: (req, res, next) => {
        if (!req.headers['x-test-user']) return res.status(401).end();
        req.user = { id: 1 };
        next();
      },
      authorize: async (_user, store) => {
        if (store !== 3) throw Error('forbidden');
      },
      service: {
        analyze: async () => {
          calls++;
          return [];
        },
      },
    })
  );
  await request(app).post('/scan').send({ store_id: 3 }).expect(401);
  await request(app).post('/scan').set('x-test-user', 'yes').send({ store_id: 4 }).expect(403);
  await request(app)
    .post('/scan?store_id=4')
    .set('x-test-user', 'yes')
    .send({ store_id: 3 })
    .expect(400);
  await request(app)
    .post('/scan')
    .set('x-test-user', 'yes')
    .send({ store_id: 3, image: frame, mimeType: 'image/jpeg', consent: true })
    .expect(200);
  assert.equal(calls, 1);
});

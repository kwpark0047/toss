const express = require('express');
const request = require('supertest');
const redact = require('../../middleware/redactAuthCallback');
const authenticate = require('../../middleware/tossWebhookAuth');

describe('Toss query authentication after early URL redaction', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test.each([
    ['?secret=fixture-shared-key', 200],
    ['?secret=wrong-key', 401],
    ['?secret=fixture-shared-key&secret=wrong-key', 401],
    ['', 401],
  ])('%s authenticates without logging credentials', async (query, expected) => {
    process.env.NODE_ENV = 'production';
    process.env.TOSS_WEBHOOK_SECRET = 'fixture-shared-key';
    delete process.env.TOSS_WEBHOOK_SIGNING_SECRET;
    delete process.env.TOSS_WEBHOOK_IPS;
    const app = express();
    const observed = [];
    app.use(redact);
    app.use((req, _res, next) => {
      observed.push(req.originalUrl);
      next();
    });
    app.post('/api/payments/webhooks/toss', authenticate, (_req, res) => res.sendStatus(200));
    await request(app)
      .post('/api/payments/webhooks/toss' + query)
      .send({})
      .expect(expected);
    expect(observed).toEqual(['/api/payments/webhooks/toss']);
  });
});

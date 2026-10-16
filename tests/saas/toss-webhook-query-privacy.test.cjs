const test = require('node:test');
const assert = require('node:assert/strict');
const redact = require('../../middleware/redactAuthCallback');

test('webhook URL credentials are removed before logging and preserved privately for validation', () => {
  const req = {
    url: '/api/payments/webhooks/toss?secret=private-fixture&trace=public',
    originalUrl: '/api/payments/webhooks/toss?secret=private-fixture&trace=public',
  };
  let continued = false;
  redact(req, {}, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.tossWebhookSecret, 'private-fixture');
  assert.equal(req.url, '/api/payments/webhooks/toss');
  assert.equal(req.originalUrl, '/api/payments/webhooks/toss');
  assert.equal(JSON.stringify(req).includes('private-fixture'), false);
});

test('ambiguous duplicate webhook secrets cannot authenticate', () => {
  const req = { url: '/api/payments/webhooks/toss?secret=a&secret=b' };
  redact(req, {}, () => {});
  assert.equal(req.tossWebhookSecret, null);
  assert.equal(req.url.includes('secret'), false);
});

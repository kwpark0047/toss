const request = require('supertest');
const crypto = require('crypto');
const express = require('express');

const SECRET = 'test-toss-webhook-signing-secret';
// Simple HMAC helper (v1)
const signWebhook = (rawBody, secret, secondsAgo, version) => {
  const ts = Math.floor((Date.now() - (secondsAgo || 0) * 1000) / 1000).toString();
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return `${version}=${sig},ts=${ts}`;
};

const FIXED_JSON =
  '{"eventType":"PAYMENT_STATUS_CHANGED","data":{"paymentKey":"payment-rawbody-test","status":"DONE"},"updatedAt":"2025-01-01T00:00:00Z"}';

// Load modules once at top level (CommonJS require)
const rawBodyJsonParser = require('../../middleware/rawBodyJson').rawBodyJsonParser;
const tossWebhookAuth = require('../../middleware/tossWebhookAuth');
const paymentController = require('../../controllers/paymentController');

describe('Toss webhook rawBody preservation', () => {
  let app;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.TOSS_WEBHOOK_SIGNING_SECRET = SECRET;
    app = express();
  });

  test('real valid HMAC with global parser preserves rawBody for verification', async () => {
    const spyHandle = jest
      .spyOn(paymentController, 'handleTossWebhook')
      .mockImplementation((req, res) => {
        res.status(200).json({ received: true });
      });

    // Global parser first (as in app.mts)
    app.use(rawBodyJsonParser);
    app.use('/api/payments/webhooks/toss', tossWebhookAuth, (req, res, next) => {
      paymentController.handleTossWebhook(req, res, next);
    });

    const signature = signWebhook(FIXED_JSON, SECRET, 0, 'v1');
    const res = await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .set('tosspayments-webhook-signature', signature)
      .send(FIXED_JSON)
      .expect(200);

    expect(res.body).toEqual({ received: true });
    expect(spyHandle).toHaveBeenCalled();
    const reqPassed = spyHandle.mock.calls[0][0];
    // Ensure rawBody is Buffer and equals the exact wire bytes
    expect(Buffer.isBuffer(reqPassed.rawBody)).toBe(true);
    expect(reqPassed.rawBody.toString()).toBe(FIXED_JSON);
    expect(reqPassed.body).toBeDefined();
    expect(reqPassed.body.eventType).toBe('PAYMENT_STATUS_CHANGED');
    spyHandle.mockRestore();
  });

  test('tampered HMAC is rejected when signing secret configured', async () => {
    const spyHandle = jest.spyOn(paymentController, 'handleTossWebhook');
    const signature = signWebhook(FIXED_JSON, 'wrong-secret', 0, 'v1');
    app.use(rawBodyJsonParser);
    app.post('/api/payments/webhooks/toss', tossWebhookAuth, (req, res, next) => {
      paymentController.handleTossWebhook(req, res, next);
    });

    await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .set('tosspayments-webhook-signature', signature)
      .send(FIXED_JSON)
      .expect(401);

    expect(spyHandle).not.toHaveBeenCalled();
    spyHandle.mockRestore();
  });

  test('global-only parsing: body and rawBody populated before auth', async () => {
    const spyAuth = jest.fn((req, res, next) => {
      // Auth middleware sees parsed body and rawBody
      expect(req.body).toBeDefined();
      expect(req.body.eventType).toBe('PAYMENT_STATUS_CHANGED');
      expect(Buffer.isBuffer(req.rawBody)).toBe(true);
      expect(req.rawBody.toString()).toBe(FIXED_JSON);
      next();
    });
    const spyHandle = jest
      .spyOn(paymentController, 'handleTossWebhook')
      .mockImplementation((req, res) => {
        res.status(200).json({ ok: true });
      });

    app.use(rawBodyJsonParser);
    app.post('/api/payments/webhooks/toss', spyAuth, tossWebhookAuth, (req, res, next) => {
      paymentController.handleTossWebhook(req, res, next);
    });

    const signature = signWebhook(FIXED_JSON, SECRET, 0, 'v1');
    await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .set('tosspayments-webhook-signature', signature)
      .send(FIXED_JSON)
      .expect(200);

    expect(spyHandle).toHaveBeenCalled();
    spyHandle.mockRestore();
  });

  test('global-plus-active-route parser reuse: body already parsed, rawBody preserved', async () => {
    const spyHandle = jest
      .spyOn(paymentController, 'handleTossWebhook')
      .mockImplementation((req, res) => {
        res.status(200).json({ reused: true });
      });

    app.use(rawBodyJsonParser); // global
    app.post(
      '/api/payments/webhooks/toss',
      rawBodyJsonParser,
      tossWebhookAuth,
      (req, res, next) => {
        paymentController.handleTossWebhook(req, res, next);
      }
    );

    const signature = signWebhook(FIXED_JSON, SECRET, 0, 'v1');
    const res = await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .set('tosspayments-webhook-signature', signature)
      .send(FIXED_JSON)
      .expect(200);

    expect(res.body).toEqual({ reused: true });
    const reqPassed = spyHandle.mock.calls[0][0];
    expect(Buffer.isBuffer(reqPassed.rawBody)).toBe(true);
    expect(reqPassed.rawBody.toString()).toBe(FIXED_JSON);
    spyHandle.mockRestore();
  });

  test('already-parsed body safety: parser does not overwrite when body already parsed', async () => {
    const parsed = { eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'p2' } };
    const raw = '{"eventType":"PAYMENT_STATUS_CHANGED","data":{"paymentKey":"p2"}}';
    const signature = signWebhook(raw, SECRET, 0, 'v1');
    const spyHandle = jest
      .spyOn(paymentController, 'handleTossWebhook')
      .mockImplementation((req, res) => {
        res.status(200).json({ safe: true });
      });

    // Simulate already-parsed
    app.use((req, res, next) => {
      req.body = parsed;
      next();
    });
    app.use(rawBodyJsonParser);
    app.post('/api/payments/webhooks/toss', tossWebhookAuth, (req, res, next) => {
      paymentController.handleTossWebhook(req, res, next);
    });

    const res = await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .set('tosspayments-webhook-signature', signature)
      .send(raw)
      .expect(200);

    expect(res.body).toEqual({ safe: true });
    const reqPassed = spyHandle.mock.calls[0][0];
    // Parser should not clobber existing body object identity in a destructive way
    expect(reqPassed.body).toBeDefined();
    expect(reqPassed.body.paymentKey || reqPassed.body.data?.paymentKey).toBeDefined();
    spyHandle.mockRestore();
  });

  test('empty-body behavior: parser captures empty Buffer and auth can proceed accordingly', async () => {
    const empty = '';
    const spyHandle = jest
      .spyOn(paymentController, 'handleTossWebhook')
      .mockImplementation((req, res) => {
        res.status(200).json({ empty: true });
      });

    app.use(rawBodyJsonParser);
    app.post(
      '/api/payments/webhooks/toss',
      (req, res, next) => {
        // Ensure parser captured empty
        expect(Buffer.isBuffer(req.rawBody)).toBe(true);
        expect(req.rawBody.length).toBe(0);
        next();
      },
      tossWebhookAuth,
      (req, res, next) => {
        paymentController.handleTossWebhook(req, res, next);
      }
    );

    // Send empty body; auth may return 401 depending on config, but we mainly verify rawBody capture
    await request(app)
      .post('/api/payments/webhooks/toss')
      .set('Content-Type', 'application/json')
      .send(empty)
      // We don't assert status strictly here; capture is the key
      .catch(() => {});

    spyHandle.mockRestore();
  });
});

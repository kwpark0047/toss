jest.mock('../../../config/prisma', () => ({
  order_push_subscriptions: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
}));
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));
const crypto = require('node:crypto');
const prisma = require('../../../config/prisma');
const web = require('web-push');
const push = require('../../../services/OrderWebPushService');
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-only',
  keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
};
beforeEach(() => {
  jest.clearAllMocks();
  process.env.WEB_PUSH_PUBLIC_KEY = 'test-public';
  process.env.WEB_PUSH_PRIVATE_KEY = 'test-private';
  prisma.order_push_subscriptions.deleteMany.mockResolvedValue({ count: 0 });
  prisma.order_push_subscriptions.updateMany.mockResolvedValue({ count: 1 });
  web.sendNotification.mockResolvedValue({ statusCode: 201 });
});
afterAll(() => {
  delete process.env.WEB_PUSH_PUBLIC_KEY;
  delete process.env.WEB_PUSH_PRIVATE_KEY;
});
test.each([
  'http://fcm.googleapis.com/a',
  'https://127.0.0.1/a',
  'https://evil.notify.windows.com.evil.test/a',
  'https://fcm.googleapis.com:444/a',
  'https://user:pw@fcm.googleapis.com/a',
])('rejects SSRF endpoint %s', (endpoint) =>
  expect(push.validateSubscription({ ...subscription, endpoint })).toBe(false)
);
test('stores encrypted subscription and preserves delivery marker on repeat consent', async () => {
  await push.subscribe(7, subscription);
  const args = prisma.order_push_subscriptions.upsert.mock.calls[0][0];
  expect(args.create.encrypted_payload).not.toContain(subscription.endpoint);
  expect(args.create.endpoint_hash).toBe(
    crypto.createHash('sha256').update(subscription.endpoint).digest('hex')
  );
  expect(args.update.sent_at).toBeUndefined();
});
async function queued() {
  await push.subscribe(7, subscription);
  return {
    id: 3,
    order_id: 7,
    attempts: 0,
    ...prisma.order_push_subscriptions.upsert.mock.calls[0][0].create,
  };
}
test('claims atomically and sends minimal payload before marking delivered', async () => {
  const row = await queued();
  prisma.order_push_subscriptions.findMany.mockResolvedValue([row]);
  await push.deliverPending();
  expect(web.sendNotification).toHaveBeenCalledWith(
    subscription,
    JSON.stringify({ type: 'ORDER_READY', orderId: 7 }),
    expect.objectContaining({ TTL: 3600, timeout: 10000 })
  );
  expect(prisma.order_push_subscriptions.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ sent_at: expect.any(Date) }) })
  );
});
test('another worker owns lease: no delivery', async () => {
  prisma.order_push_subscriptions.findMany.mockResolvedValue([await queued()]);
  prisma.order_push_subscriptions.updateMany.mockResolvedValue({ count: 0 });
  await push.deliverPending();
  expect(web.sendNotification).not.toHaveBeenCalled();
});
test.each([410, 503])('handles provider %s with disable or durable retry', async (code) => {
  prisma.order_push_subscriptions.findMany.mockResolvedValue([await queued()]);
  web.sendNotification.mockRejectedValue({ statusCode: code });
  await push.deliverPending();
  expect(prisma.order_push_subscriptions.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        enabled: code !== 410,
        last_error: String(code),
        next_attempt_at: expect.any(Date),
      }),
    })
  );
});

jest.mock('../../../config/prisma', () => ({
  idempotencyRecord: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ error: jest.fn() }));
const prisma = require('../../../config/prisma');
const idempotency = require('../../../middleware/idempotency');
const records = new Map();
const request = (overrides = {}) => ({
  method: 'POST',
  baseUrl: '/payments',
  path: '/',
  headers: { 'idempotency-key': 'key' },
  body: { amount: 100 },
  user: { id: 1 },
  ...overrides,
});
const response = () => ({
  statusCode: 200,
  set: jest.fn().mockReturnThis(),
  status(n) {
    this.statusCode = n;
    return this;
  },
  json: jest.fn(function (body) {
    this.body = body;
    return this;
  }),
});
beforeEach(() => {
  jest.clearAllMocks();
  records.clear();
  prisma.idempotencyRecord.create.mockImplementation(async ({ data }) => {
    if (records.has(data.id)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
    records.set(data.id, data);
    return data;
  });
  prisma.idempotencyRecord.findUnique.mockImplementation(async ({ where }) =>
    records.get(where.id)
  );
  prisma.idempotencyRecord.update.mockImplementation(async ({ where, data }) =>
    Object.assign(records.get(where.id), data)
  );
});
test('optional requests without a key pass through', async () => {
  const next = jest.fn();
  await idempotency()(request({ headers: {} }), response(), next);
  expect(next).toHaveBeenCalled();
});
test('required key absence is rejected', async () => {
  const res = response();
  await idempotency({ required: true })(request({ headers: {} }), res, jest.fn());
  expect(res.statusCode).toBe(400);
});
test.each([' ', 'x'.repeat(256), ['key']])('invalid key %p is rejected', async (key) => {
  const res = response();
  await idempotency()(request({ headers: { 'idempotency-key': key } }), res, jest.fn());
  expect(res.statusCode).toBe(400);
});
test('concurrent handlers admit only one', async () => {
  const next = jest.fn();
  const mw = idempotency();
  await Promise.all([mw(request(), response(), next), mw(request(), response(), next)]);
  expect(next).toHaveBeenCalledTimes(1);
});
test('completed response is replayed after middleware recreation', async () => {
  const first = response();
  const next = jest.fn();
  await idempotency()(request(), first, next);
  await first.json({ id: 12 });
  const replay = response();
  await idempotency()(request(), replay, next);
  expect(replay.body).toEqual({ id: 12 });
  expect(next).toHaveBeenCalledTimes(1);
  expect(replay.set).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
});
test('body mismatch is rejected', async () => {
  await idempotency()(request(), response(), jest.fn());
  const res = response();
  await idempotency()(request({ body: { amount: 2 } }), res, jest.fn());
  expect(res.statusCode).toBe(422);
});
test('keys are scoped by authenticated principal', async () => {
  const next = jest.fn();
  await idempotency()(request(), response(), next);
  await idempotency()(request({ user: { id: 2 } }), response(), next);
  expect(next).toHaveBeenCalledTimes(2);
});
test('database outage fails closed', async () => {
  prisma.idempotencyRecord.create.mockRejectedValue(new Error('unavailable'));
  const res = response(),
    next = jest.fn();
  await idempotency()(request(), res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(503);
});
test('uncertain results are never re-executed', async () => {
  const first = response();
  await idempotency()(request(), first, jest.fn());
  first.statusCode = 502;
  await first.json({ error: 'timeout' });
  const res = response(),
    next = jest.fn();
  await idempotency()(request(), res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(409);
});

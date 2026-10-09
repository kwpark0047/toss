jest.mock('../../../app/lib/repositories/user.repository', () => ({ findUnique: jest.fn() }));
jest.mock('../../../services/AuthSessionService', () => ({ verifyAccess: jest.fn() }));
jest.mock('../../../config/prisma', () => ({
  customer_ai_consents: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));
const db = require('../../../config/prisma');
const users = require('../../../app/lib/repositories/user.repository');
const jwt = require('jsonwebtoken');
const identity = require('../../../middleware/customerIdentity');
const run = (req) =>
  new Promise((resolve) => identity(req, {}, () => resolve(req.customerIdentity)));
beforeEach(() => {
  jest.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  require('../../../services/AuthSessionService').verifyAccess.mockImplementation(
    async (decoded) => decoded
  );
});
test('claimed body phone alone never triggers private identity lookup', async () => {
  expect(await run({ headers: {}, body: { phone: '01011112222' } })).toBeNull();
  expect(users.findUnique).not.toHaveBeenCalled();
});
test('invalid bearer remains public, without any private lookup', async () => {
  expect(await run({ headers: { authorization: 'Bearer invalid' } })).toBeNull();
  expect(users.findUnique).not.toHaveBeenCalled();
});
test('identity uses authenticated database phone, not request phone or JWT phone', async () => {
  users.findUnique.mockResolvedValue({ id: 7, phone: '01099998888' });
  db.customer_ai_consents.findUnique.mockResolvedValue({
    verified_phone: '01099998888',
    verified_at: new Date(),
    consent_at: new Date(),
    revoked_at: null,
  });
  const token = jwt.sign({ id: 7, type: 'access', phone: '01011112222' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
  });
  expect(
    await run({
      headers: { authorization: `Bearer ${token}` },
      body: { store_id: 3, phone: '01011112222' },
    })
  ).toEqual({ userId: 7, storeId: 3, phone: '01099998888' });
  expect(users.findUnique).toHaveBeenCalledWith(7);
  expect(db.customer_ai_consents.findUnique).toHaveBeenCalledWith({
    where: { store_id_user_id: { store_id: 3, user_id: 7 } },
  });
});

test.each([
  null,
  { revoked_at: new Date() },
  { verified_phone: '01011112222', verified_at: new Date(), consent_at: new Date() },
])('missing, revoked or wrong verified-phone grant never authorizes history', async (grant) => {
  users.findUnique.mockResolvedValue({ id: 7, phone: '01099998888' });
  db.customer_ai_consents.findUnique.mockResolvedValue(grant);
  const token = jwt.sign({ id: 7, type: 'access' }, process.env.JWT_SECRET);
  expect(
    await run({ headers: { authorization: `Bearer ${token}` }, body: { store_id: 3 } })
  ).toBeNull();
});
test('identity DB failure degrades to public recommendation without leaking identifier', async () => {
  users.findUnique.mockRejectedValue(new Error('DB temporarily unavailable'));
  const token = jwt.sign({ id: 7, type: 'access' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  expect(await run({ headers: { authorization: `Bearer ${token}` } })).toBeNull();
});

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { once } from 'node:events';
import logger from '../../utils/logger.js';

// Exercise the same tsx ESM imports as the server, alongside real CommonJS consumers.
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
let session: any;
let sessionReads = 0;
const prisma = {
  $transaction: async (callback: any) =>
    callback({
      authSession: {
        findUnique: async () => {
          sessionReads++;
          return session;
        },
      },
    }),
};
Module._load = function (request: string, ...args: any[]) {
  if (request === '../config/prisma') return prisma;
  if (request === '../utils/errorHandler') return { AppError: Error };
  return originalLoad.call(this, request, ...args);
};
require('node:net').Socket.prototype.connect = () => assert.fail('Network forbidden');

const mode = process.argv[2];
if (mode === 'logger') {
  assert.equal(logger, require('../../utils/logger.js'), 'ESM and CJS must share logger');
  for (const name of [
    'apiLogger',
    'dbLogger',
    'syncLogger',
    'webLogger',
    'authLogger',
    'notificationLogger',
  ]) {
    assert.equal((logger as any)[name], logger);
  }
  let output = '';
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  logger.clear();
  logger.add(new (require('winston').transports.Stream)({ stream: sink }));
  logger.error(new Error('password=fixture-error-secret 010-0000-0000'));
  logger.info('token=fixture-message-secret', { nested: { password: 'fixture-nested-secret' } });
  logger.info({ authorization: 'fixture-object-secret', safe: 'visible-fixture' });
  const finished = once(logger, 'finish');
  logger.end();
  await finished;
  for (const secret of [
    'fixture-error-secret',
    '010-0000-0000',
    'fixture-message-secret',
    'fixture-nested-secret',
    'fixture-object-secret',
  ]) {
    assert.ok(!output.includes(secret), 'Sensitive fixture must be masked');
  }
  assert.ok(output.includes('[REDACTED]'));
  assert.ok(output.includes('password=[REDACTED]'));
  assert.ok(output.includes('token=[REDACTED]'));
  assert.ok(output.includes('[REDACTED_PHONE]'));
  assert.ok(output.includes('visible-fixture'));
} else {
  const authEntry = await import('../../middleware/auth.js');
  const canonicalAuth = require('../../middleware/auth.js');
  const auth = authEntry.authMiddleware;
  assert.equal(auth, canonicalAuth.authMiddleware, 'ESM and CJS must share session-verifying auth');
  assert.equal(authEntry.optionalAuth, canonicalAuth.optionalAuth);
  const jwt = require('jsonwebtoken');
  const token = (patch = {}, algorithm = 'HS256') =>
    jwt.sign(
      { id: 7, type: 'access', sid: 'fixture-session', role: 'super_admin', ...patch },
      process.env.JWT_SECRET,
      { algorithm }
    );
  const invoke = async (signed: string | null, optional = false, cookie = false) => {
    const req: any = {
      headers: signed && !cookie ? { authorization: `Bearer ${signed}` } : {},
      cookies: cookie ? { token: signed } : {},
    };
    let status = 200,
      nextCalls = 0;
    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json() {},
    };
    await (optional ? authEntry.optionalAuth : auth)(req, res, () => {
      nextCalls++;
    });
    return { status, nextCalls, user: req.user };
  };
  session = {
    user_id: 7,
    expires_at: new Date(Date.now() + 60000),
    revoked_at: null,
    user: { name: 'fixture', role: 'staff', auth_status: 'active' },
  };
  const active = await invoke(token());
  assert.equal(active.nextCalls, 1);
  assert.equal(active.user.role, 'staff', 'Current session role must replace stale JWT admin role');
  process.env.USE_HTTPONLY_COOKIE = 'true';
  assert.equal((await invoke(token(), false, true)).user.role, 'staff');
  session.revoked_at = new Date();
  assert.equal((await invoke(token())).status, 401);
  const optional = await invoke(token(), true);
  assert.equal(optional.nextCalls, 1);
  assert.equal(optional.user, undefined);
  session.revoked_at = null;
  session.expires_at = new Date(0);
  assert.equal((await invoke(token())).status, 401);
  session = null;
  assert.equal((await invoke(token())).status, 401);
  const reads = sessionReads;
  assert.equal((await invoke(token({}, 'HS384'))).status, 401);
  assert.equal((await invoke(token({ type: 'refresh' }))).status, 401);
  assert.equal((await invoke(token({ sid: undefined }))).status, 401);
  assert.equal((await invoke(null)).status, 401);
  assert.equal(sessionReads, reads, 'Invalid token payload must not query a session');
  assert.ok(sessionReads >= 5);
  logger.close();
}
console.log(JSON.stringify({ mode, networkCalls: 0, passed: true }));

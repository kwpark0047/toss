const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const loader = Module._load;
let clients = 0,
  sdkLoads = 0,
  sdkInits = 0;
const sdk = {
  init() {
    sdkInits++;
  },
  captureException() {},
  captureMessage() {},
};
const logger = { debug() {}, info() {}, warn() {}, error() {} };
Module._load = function (request, parent, ...args) {
  if (request === '@sentry/node') {
    sdkLoads++;
    return sdk;
  }
  if (request.includes('generated/prisma'))
    return {
      PrismaClient: class {
        constructor() {
          clients++;
        }
        $on() {}
        $connect() {
          assert.fail('DB connection forbidden');
        }
        $queryRaw() {
          assert.fail('DB query forbidden');
        }
        async $disconnect() {}
      },
    };
  if (request.endsWith('/logger') || request.endsWith('/logger.js')) return logger;
  return loader.call(this, request, parent, ...args);
};
require('node:net').Socket.prototype.connect = () => assert.fail('network forbidden');
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/test';
process.env.REPLICA_URL = process.argv.includes('--replica')
  ? 'postgresql://fixture:fixture@127.0.0.1:2/test'
  : process.env.DATABASE_URL;
delete process.env.SENTRY_DSN;
process.env.NODE_ENV = 'development'; // Exercise initialization with the injected SDK, not the test-mode early return.
(async () => {
  const tsFirst = process.argv.includes('--ts-first');
  const loadTs = async (file) => (await import(pathToFileURL(path.join(root, file)).href)).default;
  let prismaTs, sentryTs;
  if (tsFirst) {
    prismaTs = await loadTs('config/prisma.ts');
    sentryTs = await loadTs('utils/sentry.ts');
  }
  const prismaJs = require(path.join(root, 'config/prisma.js'));
  const sentryJs = require(path.join(root, 'utils/sentry.js'));
  if (!tsFirst) {
    prismaTs = await loadTs('config/prisma.ts');
    sentryTs = await loadTs('utils/sentry.ts');
  }
  assert.equal(prismaTs, prismaJs);
  assert.equal(sentryTs, sentryJs);
  assert.equal(clients, process.argv.includes('--replica') ? 2 : 1);
  assert.equal(sdkLoads, 0);
  assert.equal(sentryTs.initSentry(), null);
  assert.equal(sdkLoads, 0);
  process.env.SENTRY_DSN = 'https://fixture@example.invalid/1';
  sentryTs.initSentry();
  sentryJs.initSentry();
  assert.equal(sdkLoads, 1);
  assert.equal(sdkInits, 1);
  assert.equal(sentryJs.sanitizeValue({ password: 'fixture' }).password, '[REDACTED]');
  console.log(JSON.stringify({ clients, sdkLoads, sdkInits, tsFirst, networkCalls: 0 }));
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});

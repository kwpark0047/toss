// Uses dummy configuration and no database writes or external payment requests.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
process.env.DOTENV_CONFIG_PATH = '.__startup_smoke_no_env__';
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test?connect_timeout=1';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = 'startup-smoke-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'startup-smoke-refresh-with-at-least-32-characters';
process.env.PORT = '0';
process.env.BILLING_SCHEDULER_ENABLED = 'false';
for (const key of [
  'REDIS_URL',
  'SENTRY_DSN',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'TOSS_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALERT_WEBHOOK_URL',
])
  process.env[key] = '';
// Suppress background metric writes; database readiness is tested separately.
const require = createRequire(import.meta.url);
require('../repositories/Monitoring.js').Metrics.record = async () => {};
const { httpServer, shutdown } = await import('../index.mts');
if (!httpServer.listening) await once(httpServer, 'listening');
const { port } = httpServer.address();
try {
  const live = await fetch(`http://127.0.0.1:${port}/api/health/live`);
  assert.equal(live.status, 200);
  await live.arrayBuffer();
  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/subscriptions/1`);
  assert.equal(
    protectedRoute.status,
    401,
    'real subscription router must be reachable and protected'
  );
  await protectedRoute.arrayBuffer();
  const preflight = await fetch(`http://127.0.0.1:${port}/api/payments`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Headers': 'x-order-capability,idempotency-key',
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-Order-Capability/i);
  await preflight.arrayBuffer();
  console.log('Startup smoke passed: actual app, protected subscription route, capability CORS.');
  shutdown();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

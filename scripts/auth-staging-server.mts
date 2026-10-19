import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const target = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV !== 'development' || target.hostname !== '127.0.0.1' ||
    target.port !== '55438' || target.pathname !== '/wemarket_test_staging_20261010') {
  throw Error('ISOLATED_AUTH_STAGING_REQUIRED');
}
const { httpServer, io } = await import('../app.mts');
httpServer.listen(5340, 'localhost', () => console.log('Auth staging listening on localhost:5340'));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  httpServer.closeIdleConnections();
  io.close(async () => {
    await require('../utils/runtimeResources.js').closeRuntimeResources();
    await require('../config/prisma.js').disconnectAll();
    await Promise.allSettled([...require('node-cron').getTasks().values()].map(task => task.stop()));
  });
}
httpServer.on('error', () => { process.exitCode = 1; void stop(); });
process.once('SIGINT', stop); process.once('SIGTERM', stop);


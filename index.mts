import 'dotenv/config';
import { httpServer, io } from './app.mts';
import logger from './utils/logger.ts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const prismaModule = require('./config/prisma.js');
const prisma = typeof prismaModule.$connect === 'function' ? prismaModule : prismaModule.default;
import { getRedisCache } from './utils/redisCache.js';
import { startBillingScheduler } from './services/billingScheduler.js';

const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
}
const stopBilling = startBillingScheduler();
const stopWebhook = process.env.WEBHOOK_RETRY_ENABLED === 'true' && process.env.NODE_ENV !== 'test'
    ? require('./services/webhookDispatcher.js').startRetryScheduler()
    : () => {};
httpServer.on('error', (error) => {
    logger.error('HTTP server failed', { error: error.message });
    process.exitCode = 1;
    shutdown();
});
httpServer.listen(PORT, () => {
    logger.info(`WeMarket API listening on port ${PORT}`);
    // Prepare the pool without blocking static/health/live responses or running billing.
    void Promise.resolve().then(() => prisma.$connect()).catch(() => logger.warn('Database startup connection is not ready'));
});

let stopping = false;
function shutdown() {
    if (stopping) return;
    stopping = true;
    const drains = Promise.all([stopBilling(), stopWebhook()]);
    const timeout = setTimeout(() => process.exit(1), 30_000);
    timeout.unref();
    httpServer.closeIdleConnections();
    io.close(async () => {
        await drains;
        await Promise.allSettled([
            Promise.resolve().then(() => prisma.disconnectAll()),
            Promise.resolve().then(() => getRedisCache().disconnect()),
            Promise.resolve().then(() => require('./utils/cache.js').hybridCache.close()),
            Promise.resolve().then(() => require('./utils/aiRateLimiter.js').shutdownAIRateLimiter()),
            Promise.resolve().then(() => require('./utils/runtimeResources.js').closeRuntimeResources()),
        ]);
        const cron = require('node-cron');
        await Promise.allSettled([...cron.getTasks().values()].map((task: { stop: () => unknown }) => Promise.resolve(task.stop())));
        clearTimeout(timeout);
        // Let native database handles finish closing before Node exits.
        process.exitCode = process.exitCode || 0;
    });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
export { httpServer, PORT, shutdown };

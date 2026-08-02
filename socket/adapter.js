const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { dbLogger } = require('../utils/logger');

/**
 * Configure Redis adapter for Socket.IO horizontal scaling
 * @param {import('socket.io').Server} io
 */
async function setupSocketRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://localhost:6379';

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      dbLogger.error({ error: err.message }, 'Redis Pub Client Error')
    );
    subClient.on('error', (err) =>
      dbLogger.error({ error: err.message }, 'Redis Sub Client Error')
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    dbLogger.info(
      { redisUrl: redisUrl.replace(/\/\/.+@/, '//***@') },
      'Socket.IO Redis adapter configured successfully for horizontal scaling'
    );
  } catch (error) {
    dbLogger.warn(
      { error: error.message },
      'Failed to connect Redis for Socket.IO adapter. Falling back to in-memory adapter.'
    );
  }
}

module.exports = { setupSocketRedisAdapter };

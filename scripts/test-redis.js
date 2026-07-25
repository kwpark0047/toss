const { createClient } = require('redis');

async function testRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  console.log(`[Redis Test] Connecting to: ${redisUrl}`);
  
  const client = createClient({ 
    url: redisUrl,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 3) return new Error('Max retries reached');
        return Math.min(retries * 100, 3000);
      }
    }
  });
  
  client.on('error', (err) => {
    console.error('[Redis Test] Error:', err.message);
  });
  
  client.on('connect', () => {
    console.log('[Redis Test] Connected');
  });
  
  try {
    await client.connect();
    
    const testKey = 'wemarket:test:key';
    const testValue = JSON.stringify({ message: 'Hello WeMarket!', timestamp: Date.now() });
    
    await client.setEx(testKey, 60, testValue);
    console.log('[Redis Test] SET OK');
    
    const retrieved = await client.get(testKey);
    console.log('[Redis Test] GET OK:', retrieved);
    
    await client.del(testKey);
    console.log('[Redis Test] DEL OK');
    
    const pong = await client.ping();
    console.log('[Redis Test] PING:', pong);
    
    const keys = await client.keys('wemarket:*');
    console.log('[Redis Test] KEYS:', keys.length, 'keys found');
    
    await client.disconnect();
    console.log('[Redis Test] Disconnected');
    
    return true;
  } catch (err) {
    console.error('[Redis Test] Failed:', err.message);
    return false;
  }
}

if (require.main === module) {
  testRedisConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testRedisConnection };

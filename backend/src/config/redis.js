const Redis = require('ioredis');

let client = null;
let isConnected = false;

function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  let errorLogged = false;

  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 3000,
    // Stop retrying after first failure — no spam
    retryStrategy: () => null,
  });

  client.on('connect', () => {
    isConnected = true;
    errorLogged = false;
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    isConnected = false;
    // Log only once to avoid flooding the console
    if (!errorLogged) {
      errorLogged = true;
      console.warn('[Redis] Could not connect:', err.message);
      console.warn('[Redis] Rate limiting and caching will be disabled.');
    }
  });

  client.on('close', () => {
    isConnected = false;
  });

  client.connect().catch(() => {
    // Already handled by the 'error' event above
  });

  return client;
}

function isRedisReady() {
  return isConnected && client && client.status === 'ready';
}

module.exports = { getRedisClient, isRedisReady };

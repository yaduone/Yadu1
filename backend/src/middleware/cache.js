/**
 * Response Caching Middleware — Redis Read-Through Cache
 *
 * Strategy: Cache-first (read-through).
 *   1. Check Redis for cached response.
 *   2. If hit → return immediately (no DB/Firebase call).
 *   3. If miss → let route handler run, intercept response, store in Redis.
 *
 * Cache key format: `cache:{method}:{path}:{queryHash}:{scope}`
 *   scope = userId/adminId for private data, "public" for shared data
 *
 * TTL tiers:
 *   public static  → 300s  (areas, prices, active products)
 *   user private   → 30s   (cart, subscription, profile)
 *   admin data     → 60s   (orders list, users list, reports)
 *   reports/heavy  → 120s  (dashboard, daily stats)
 *
 * Invalidation: tag-based. Each cached entry stores tags (e.g. "products", "user:{id}").
 * Call invalidateCache(tags) to bust related entries.
 *
 * Falls back gracefully if Redis is unavailable.
 */

const { getRedisClient, isRedisReady } = require('../config/redis');
const crypto = require('crypto');

/**
 * Hash query params for stable cache keys.
 */
function hashQuery(query) {
  if (!query || Object.keys(query).length === 0) return '';
  const sorted = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join('&');
  return ':' + crypto.createHash('md5').update(sorted).digest('hex').slice(0, 8);
}

/**
 * Determine cache scope (public vs user-scoped vs admin-scoped).
 */
function getScope(req) {
  if (req.user?.userId) return `u:${req.user.userId}`;
  if (req.admin?.adminId) return `a:${req.admin.adminId}`;
  return 'pub';
}

/**
 * Build the Redis cache key.
 */
function buildCacheKey(req) {
  const scope = getScope(req);
  const path = req.path.replace(/\//g, ':').replace(/^:/, '');
  const qHash = hashQuery(req.query);
  return `cache:${path}${qHash}:${scope}`;
}

/**
 * Factory: creates a caching middleware with given TTL and optional tags.
 *
 * @param {number} ttl - seconds to cache
 * @param {string[]} tags - cache tags for invalidation (e.g. ['products'])
 */
function cacheResponse(ttl, tags = []) {
  return async function cacheMiddleware(req, res, next) {
    // Only cache GET requests
    if (req.method !== 'GET') return next();
    if (!isRedisReady()) return next();

    const redis = getRedisClient();
    const key = buildCacheKey(req);

    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-TTL', await redis.ttl(key));
        return res.json(parsed);
      }
    } catch (err) {
      console.error('[Cache] Read error:', err.message);
      return next();
    }

    // Cache miss — intercept the response
    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && isRedisReady()) {
        try {
          const redis2 = getRedisClient();
          const pipeline = redis2.pipeline();
          pipeline.set(key, JSON.stringify(body), 'EX', ttl);

          // Store tag → key mappings for invalidation
          for (const tag of tags) {
            pipeline.sadd(`tag:${tag}`, key);
            pipeline.expire(`tag:${tag}`, ttl + 60); // tag set lives slightly longer
          }

          await pipeline.exec();
        } catch (err) {
          console.error('[Cache] Write error:', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate all cache entries associated with given tags.
 * Call this after mutations (POST/PUT/DELETE) to bust stale data.
 *
 * @param {string[]} tags
 */
async function invalidateCache(tags) {
  if (!isRedisReady()) return;
  const redis = getRedisClient();

  try {
    for (const tag of tags) {
      const keys = await redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.del(...keys);
        pipeline.del(`tag:${tag}`);
        await pipeline.exec();
      }
    }
  } catch (err) {
    console.error('[Cache] Invalidation error:', err.message);
  }
}

/**
 * Middleware to invalidate cache tags after a mutating request succeeds.
 * Usage: router.post('/', invalidateOn(['products']), handler)
 */
function invalidateOn(tags) {
  return async function (req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await invalidateCache(tags).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

// Pre-configured cache middlewares
const cache = {
  publicStatic: cacheResponse(300, ['public']),       // areas, prices, products list
  userPrivate:  cacheResponse(30,  []),                // cart, subscription (scoped by userId)
  adminData:    cacheResponse(60,  []),                // orders, users (scoped by adminId)
  reports:      cacheResponse(120, ['reports']),       // dashboard, daily stats
};

module.exports = { cacheResponse, invalidateCache, invalidateOn, cache };

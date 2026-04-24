/**
 * Rate Limiting Middleware — Sliding Window via Redis
 *
 * Strategy: Sliding Window Counter using Redis sorted sets.
 * Each request is stored as a timestamped entry; old entries outside
 * the window are pruned on every request. This gives accurate per-window
 * counts without the boundary spike problem of fixed windows.
 *
 * Tiers:
 *   auth    → 5 req / 60s   (strict — prevents brute force)
 *   heavy   → 10 req / 60s  (uploads, manifest generation, reports)
 *   medium  → 60 req / 60s  (authenticated user actions)
 *   public  → 120 req / 60s (public read endpoints)
 *
 * Key strategy: `rl:{tier}:{identifier}` where identifier is:
 *   - userId (from JWT/Firebase) when authenticated
 *   - IP address as fallback for unauthenticated requests
 *
 * Falls back to in-memory (no limiting) if Redis is unavailable.
 */

const { getRedisClient, isRedisReady } = require('../config/redis');

const TIERS = {
  auth:   { max: 5,   windowSec: 60 },
  heavy:  { max: 10,  windowSec: 60 },
  medium: { max: 60,  windowSec: 60 },
  public: { max: 120, windowSec: 60 },
};

/**
 * Extract a stable identifier for the requester.
 * Prefers authenticated user/admin ID over IP.
 */
function getIdentifier(req) {
  if (req.user?.userId) return `user:${req.user.userId}`;
  if (req.admin?.adminId) return `admin:${req.admin.adminId}`;
  // Respect X-Forwarded-For from trusted proxies (Nginx, load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return `ip:${ip}`;
}

/**
 * Core sliding window check using Redis sorted sets.
 * Returns { allowed, remaining, resetAfter }
 */
async function slidingWindowCheck(key, max, windowSec) {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const expireAt = now + windowSec * 1000;

  // Lua script for atomic sliding window — avoids race conditions
  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local max = tonumber(ARGV[3])
    local expire_ms = tonumber(ARGV[4])
    local member = ARGV[5]

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Count current requests in window
    local count = redis.call('ZCARD', key)

    if count < max then
      -- Add this request
      redis.call('ZADD', key, now, member)
      redis.call('PEXPIRE', key, expire_ms)
      return {1, max - count - 1}
    else
      -- Get oldest entry to calculate reset time
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local reset_after = 0
      if oldest[2] then
        reset_after = math.ceil((tonumber(oldest[2]) + expire_ms - now) / 1000)
      end
      return {0, reset_after}
    end
  `;

  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  const result = await redis.eval(
    luaScript, 1, key,
    now, windowStart, max, windowSec * 1000, member
  );

  if (result[0] === 1) {
    return { allowed: true, remaining: result[1], resetAfter: windowSec };
  } else {
    return { allowed: false, remaining: 0, resetAfter: result[1] || windowSec };
  }
}

/**
 * Factory: creates a rate limiter middleware for a given tier.
 */
function createRateLimiter(tier) {
  const { max, windowSec } = TIERS[tier];

  return async function rateLimitMiddleware(req, res, next) {
    // Skip if Redis is not available — graceful degradation
    if (!isRedisReady()) return next();

    const identifier = getIdentifier(req);
    const key = `rl:${tier}:${identifier}`;

    try {
      const { allowed, remaining, resetAfter } = await slidingWindowCheck(key, max, windowSec);

      // Always set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, remaining),
        'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + resetAfter,
        'X-RateLimit-Policy': `${max};w=${windowSec}`,
      });

      if (!allowed) {
        res.set('Retry-After', resetAfter);
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${resetAfter} second${resetAfter !== 1 ? 's' : ''}.`,
          retryAfter: resetAfter,
        });
      }

      next();
    } catch (err) {
      // Redis error — fail open (don't block legitimate traffic)
      console.error('[RateLimit] Redis error, failing open:', err.message);
      next();
    }
  };
}

// Pre-built limiters for each tier
const limiters = {
  auth:   createRateLimiter('auth'),
  heavy:  createRateLimiter('heavy'),
  medium: createRateLimiter('medium'),
  public: createRateLimiter('public'),
};

module.exports = limiters;

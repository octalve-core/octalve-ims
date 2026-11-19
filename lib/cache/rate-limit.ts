/**
 * Rate Limiting Utilities
 * Redis-based rate limiting with sliding window algorithm
 */

import { getRedis } from "./redis";
import { logger } from "@/lib/logger";

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  limit: number;
  /**
   * Time window in seconds
   */
  window: number;
  /**
   * Identifier for the rate limit (e.g., user ID, IP address)
   */
  identifier: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;
  /**
   * Current request count in the window
   */
  current: number;
  /**
   * Maximum allowed requests
   */
  limit: number;
  /**
   * Time remaining until the window resets (in seconds)
   */
  reset: number;
}

/**
 * Prune-count-record as one atomic server-side script, not three separate round trips. The
 * old check-then-record version (ZREMRANGEBYSCORE, then ZCARD, then conditionally ZADD) let a
 * burst of concurrent requests all read "under the limit" before any of them recorded its own
 * entry, so the burst could race past the configured limit. A Lua script is the Redis-native
 * way to make a multi-step read-then-write atomic without a separate lock.
 *
 * Returns [allowed (1/0), current count after this check, oldest entry's score (0 if none/not
 * needed)] — a plain array, since Lua-to-JS reply conversion doesn't carry field names.
 */
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local current = redis.call('ZCARD', key)

if current >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_score = 0
  if oldest[2] then
    oldest_score = tonumber(oldest[2])
  end
  return {0, current, oldest_score}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, math.ceil(window_ms / 1000))
return {1, current + 1, 0}
`;

/**
 * Check rate limit using sliding window algorithm
 *
 * @param config - Rate limit configuration
 * @returns Promise<RateLimitResult> - Rate limit result
 */
export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    // Graceful degradation: allow all requests if Redis not available
    logger.warn("Redis not available, rate limiting disabled");
    return {
      allowed: true,
      current: 0,
      limit: config.limit,
      reset: config.window,
    };
  }

  try {
    const key = `rate-limit:${config.identifier}`;
    const now = Date.now();
    const windowMs = config.window * 1000;
    const member = `${now}-${Math.random()}`;

    const [allowedFlag, current, oldestScore] = await redis.eval<
      [number, number, number]
    >(RATE_LIMIT_SCRIPT, [key], [String(windowMs), String(config.limit), String(now), member]);

    if (allowedFlag === 0) {
      const resetTime =
        oldestScore > 0
          ? Math.ceil((oldestScore + windowMs - now) / 1000)
          : config.window;
      return {
        allowed: false,
        current,
        limit: config.limit,
        reset: Math.max(0, resetTime),
      };
    }

    return {
      allowed: true,
      current,
      limit: config.limit,
      reset: config.window,
    };
  } catch (error) {
    logger.error("Rate limit check failed:", error);
    // Graceful degradation: allow request on error
    return {
      allowed: true,
      current: 0,
      limit: config.limit,
      reset: config.window,
    };
  }
}

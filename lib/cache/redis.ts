/**
 * Redis Cache Client
 * Unified client supporting both Local TCP Redis (REDIS_URL via ioredis)
 * and Upstash HTTP REST Redis (UPSTASH_REDIS_URL / TOKEN via @upstash/redis).
 * Gracefully degrades if Redis is not configured.
 */

import { Redis as UpstashRedis } from "@upstash/redis";
import RedisIORedis from "ioredis";
import { logger } from "@/lib/logger";

/**
 * Unified Redis interface across both Upstash REST and standard TCP Redis (ioredis)
 */
export interface UnifiedRedisClient {
  readonly type: "ioredis" | "upstash";
  ping(): Promise<string>;
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    options?: { ex?: number }
  ): Promise<string | "OK">;
  setex(key: string, seconds: number, value: unknown): Promise<string | "OK">;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  scan(
    cursor: number | string,
    options?: { match?: string; count?: number }
  ): Promise<[number | string, string[]]>;
  zadd(
    key: string,
    scoreOrData: number | { score: number; member: string },
    member?: string
  ): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean }
  ): Promise<Array<{ member: string; score: number }> | string[]>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
}

class UpstashAdapter implements UnifiedRedisClient {
  readonly type = "upstash" as const;
  constructor(private client: UpstashRedis) {}

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number }
  ): Promise<string | "OK"> {
    if (options?.ex != null) {
      const res = await this.client.set(key, value as any, { ex: options.ex });
      return (res as string | "OK") ?? "OK";
    }
    const res = await this.client.set(key, value as any);
    return (res as string | "OK") ?? "OK";
  }

  async setex(
    key: string,
    seconds: number,
    value: unknown
  ): Promise<string | "OK"> {
    const res = await this.client.setex(key, seconds, value as any);
    return (res as string | "OK") ?? "OK";
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async scan(
    cursor: number | string,
    options?: { match?: string; count?: number }
  ): Promise<[number | string, string[]]> {
    return (this.client.scan as any)(Number(cursor), options) as Promise<
      [number | string, string[]]
    >;
  }

  async zadd(
    key: string,
    scoreOrData: number | { score: number; member: string },
    member?: string
  ): Promise<number> {
    if (typeof scoreOrData === "object") {
      const res = await this.client.zadd(key, scoreOrData);
      return res ?? 0;
    }
    const res = await this.client.zadd(key, {
      score: scoreOrData,
      member: member ?? "",
    });
    return res ?? 0;
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean }
  ): Promise<Array<{ member: string; score: number }> | string[]> {
    return (this.client.zrange as any)(key, start, stop, options) as Promise<
      Array<{ member: string; score: number }> | string[]
    >;
  }

  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number> {
    return this.client.zremrangebyscore(key, min as any, max as any);
  }

  async zremrangebyrank(
    key: string,
    start: number,
    stop: number
  ): Promise<number> {
    return this.client.zremrangebyrank(key, start, stop);
  }
}

class IORedisAdapter implements UnifiedRedisClient {
  readonly type = "ioredis" as const;
  constructor(private client: RedisIORedis) {}

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number }
  ): Promise<string | "OK"> {
    // Always JSON-encode (even plain strings) so get()'s JSON.parse round-trips
    // the exact original type. Storing strings raw made "123"/"true"/"null"
    // silently come back as a number/boolean/null instead of the cached string.
    const str = JSON.stringify(value);
    if (options?.ex != null) {
      return this.client.set(key, str, "EX", options.ex);
    }
    return this.client.set(key, str);
  }

  async setex(
    key: string,
    seconds: number,
    value: unknown
  ): Promise<string | "OK"> {
    const str = JSON.stringify(value);
    return this.client.setex(key, seconds, str);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async scan(
    cursor: number | string,
    options?: { match?: string; count?: number }
  ): Promise<[number | string, string[]]> {
    const curStr = cursor.toString();
    if (options?.match && options?.count) {
      return this.client.scan(
        curStr,
        "MATCH",
        options.match,
        "COUNT",
        options.count
      );
    }
    if (options?.match) {
      return this.client.scan(curStr, "MATCH", options.match);
    }
    if (options?.count) {
      return this.client.scan(curStr, "COUNT", options.count);
    }
    return this.client.scan(curStr);
  }

  async zadd(
    key: string,
    scoreOrData: number | { score: number; member: string },
    member?: string
  ): Promise<number> {
    let score: number;
    let mem: string;
    if (typeof scoreOrData === "object") {
      score = scoreOrData.score;
      mem = scoreOrData.member;
    } else {
      score = scoreOrData;
      mem = member ?? "";
    }
    return this.client.zadd(key, score, mem);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { withScores?: boolean }
  ): Promise<Array<{ member: string; score: number }> | string[]> {
    if (options?.withScores) {
      // Default RESP2 protocol: flat [member, score, member, score, ...] array.
      const res = (await this.client.zrange(
        key,
        String(start),
        String(stop),
        "WITHSCORES"
      )) as string[];
      const out: Array<{ member: string; score: number }> = [];
      for (let i = 0; i < res.length; i += 2) {
        out.push({ member: res[i] as string, score: Number(res[i + 1]) });
      }
      return out;
    }
    return this.client.zrange(key, String(start), String(stop));
  }

  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  async zremrangebyrank(
    key: string,
    start: number,
    stop: number
  ): Promise<number> {
    return this.client.zremrangebyrank(key, start, stop);
  }
}

/**
 * Check if Redis is configured
 * Supports both standard TCP Redis (REDIS_URL) and Upstash REST Redis
 *
 * @returns boolean - True if Redis credentials/URL are configured
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL ||
    ((process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN))
  );
}

/**
 * Get Redis client instance adapter
 * Returns null if Redis is not configured (graceful degradation)
 *
 * @returns UnifiedRedisClient | null - Unified Redis client instance or null
 */
export function getRedisClient(): UnifiedRedisClient | null {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    // On Vercel, a persistent TCP client (ioredis) per serverless invocation
    // exhausts the target Redis server's connection limit — the exact
    // problem the HTTP-based Upstash client exists to avoid. Never use
    // REDIS_URL there, even if it happens to be set (e.g. copied into a
    // Vercel env-var config by accident); always prefer Upstash on this
    // platform. `VERCEL` is set automatically in every Vercel environment
    // (production, preview, and `vercel dev`).
    const onVercel = !!process.env.VERCEL;

    // Priority 1: Standard TCP Redis URL (local or a persistent non-Vercel host, e.g. redis://localhost:6379)
    if (process.env.REDIS_URL && !onVercel) {
      const ioClient = new RedisIORedis(process.env.REDIS_URL, {
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        // Never return null/give up: Redis here is an optional cache/rate-limit
        // layer, and a permanent retryStrategy bail-out would leave the
        // singleton holding a dead client (and every cache op silently
        // disabled) until the whole app is restarted. Keep retrying forever
        // with a capped backoff so it self-heals once Redis comes back.
        retryStrategy(times) {
          return Math.min(times * 200, 5000);
        },
      });
      // ioredis throws (crashing the process) if an 'error' event has no
      // listener — this is required, not optional, for graceful degradation.
      ioClient.on("error", (err) => {
        logger.error("Redis (ioredis) connection error:", err);
      });
      return new IORedisAdapter(ioClient);
    }

    // Priority 2: Upstash REST Redis
    const url =
      process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return null;
    }

    const upstashClient = new UpstashRedis({ url, token });
    return new UpstashAdapter(upstashClient);
  } catch (error) {
    logger.error("Failed to create Redis client:", error);
    return null;
  }
}

/**
 * Redis client singleton instance
 */
let redisClient: UnifiedRedisClient | null = null;

/**
 * Get or create Redis client singleton
 *
 * @returns UnifiedRedisClient | null - Unified Redis client instance or null
 */
export function getRedis(): UnifiedRedisClient | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!redisClient) {
    redisClient = getRedisClient();
    if (redisClient) {
      logger.info(
        `✅ Redis client initialized successfully (${redisClient.type} driver)`
      );
    } else {
      logger.warn("⚠️ Redis client initialization failed - caching disabled");
    }
  }

  return redisClient;
}

/**
 * Initialize Redis connection and log status
 */
export function initializeRedis(): void {
  if (isRedisConfigured()) {
    const client = getRedis();
    if (client) {
      logger.info(`✅ Redis caching enabled (${client.type} driver)`);
    } else {
      logger.warn(
        "⚠️ Redis credentials configured but connection failed - caching disabled"
      );
    }
  } else {
    logger.debug(
      "ℹ️ Redis not configured - caching disabled (graceful degradation)"
    );
  }
}

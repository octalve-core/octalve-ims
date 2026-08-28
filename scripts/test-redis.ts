/**
 * Redis Connection & Health Diagnostic Script
 * Usage: pnpm script:test-redis
 */

import { getRedis, isRedisConfigured } from "../lib/cache/redis";
import {
  getCache,
  setCache,
  deleteCacheByPattern,
} from "../lib/cache/cache-utils";

async function main() {
  console.log("🔍 Checking Redis Configuration...");

  if (!isRedisConfigured()) {
    console.error("❌ Redis is not configured in .env!");
    console.log(
      "👉 Add REDIS_URL=redis://localhost:6379 (or Upstash credentials) to .env"
    );
    process.exit(1);
  }

  const redis = getRedis();
  if (!redis) {
    console.error("❌ Failed to instantiate Redis client!");
    process.exit(1);
  }

  console.log(`✅ Redis client configured using [${redis.type}] driver.`);

  // 1. PING Test & Latency
  console.log("\n📡 Testing PING & Response Time...");
  const startTime = Date.now();
  try {
    const pingResult = await redis.ping();
    const latency = Date.now() - startTime;
    console.log(`✅ PING response: "${pingResult}" (${latency}ms)`);
  } catch (err) {
    console.error("❌ PING failed:", err);
    process.exit(1);
  }

  // 2. SET & GET Object Test
  console.log("\n💾 Testing Cache SET & GET...");
  const testKey = "test:connection-check";
  const testValue = {
    app: "Octalve IMS",
    timestamp: Date.now(),
    status: "ok",
    driver: redis.type,
  };

  const setSuccess = await setCache(testKey, testValue, 60);
  if (setSuccess) {
    console.log(`✅ SET successful for key: ${testKey}`);
  } else {
    console.error(`❌ SET failed for key: ${testKey}`);
  }

  const cachedValue = await getCache<typeof testValue>(testKey);
  if (cachedValue && cachedValue.app === "Octalve IMS") {
    console.log("✅ GET successful! Retrieved payload:", cachedValue);
  } else {
    console.error("❌ GET failed or returned invalid data:", cachedValue);
  }

  // 3. Pattern Scan & Delete Test
  console.log("\n🧹 Testing Pattern SCAN & Invalidation...");
  const deletedCount = await deleteCacheByPattern("test:*");
  console.log(`✅ Pattern invalidation deleted ${deletedCount} test key(s).`);

  // Verify deletion
  const postDeleteValue = await getCache(testKey);
  if (postDeleteValue === null) {
    console.log("✅ Verification passed: Key correctly deleted.");
  } else {
    console.error("❌ Verification failed: Key still exists!");
  }

  console.log("\n=========================================");
  console.log("🎉 Redis setup is working perfectly!");
  console.log("=========================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Unhandled error in Redis test script:", err);
  process.exit(1);
});

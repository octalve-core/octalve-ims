import { describe, expect, it, vi, beforeEach } from "vitest";

const redisMock = {
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@/lib/cache/redis", () => ({
  isRedisConfigured: () => true,
  getRedis: () => redisMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("getCacheStats (ISS-0076)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts hits/misses when redis.get() returns JSON.parse'd numbers, not strings", async () => {
    // redis.incr() stores a raw Redis integer; the unified client's get()
    // JSON.parses whatever comes back, so a real read returns a number —
    // the old `typeof hits === "string"` check always missed this and
    // silently reported hitRate: 0 regardless of real traffic.
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === "metrics:cache:hits") return 7;
      if (key === "metrics:cache:misses") return 3;
      return null;
    });

    const { getCacheStats } = await import("./system-metrics");
    const stats = await getCacheStats();

    expect(stats.hits).toBe(7);
    expect(stats.misses).toBe(3);
    expect(stats.totalRequests).toBe(10);
    expect(stats.hitRate).toBe(70);
  });

  it("still handles a string-encoded count", async () => {
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === "metrics:cache:hits") return "4";
      if (key === "metrics:cache:misses") return "1";
      return null;
    });

    const { getCacheStats } = await import("./system-metrics");
    const stats = await getCacheStats();

    expect(stats.hits).toBe(4);
    expect(stats.misses).toBe(1);
  });
});

describe("trackCacheHit / trackCacheMiss (ISS-0076)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the TTL only when the counter is first created", async () => {
    redisMock.incr.mockResolvedValueOnce(1);
    const { trackCacheHit } = await import("./system-metrics");
    await trackCacheHit();
    expect(redisMock.expire).toHaveBeenCalledWith("metrics:cache:hits", 86400);
  });

  it("does not refresh the TTL on subsequent increments", async () => {
    redisMock.incr.mockResolvedValueOnce(2);
    const { trackCacheHit } = await import("./system-metrics");
    await trackCacheHit();
    expect(redisMock.expire).not.toHaveBeenCalled();
  });
});

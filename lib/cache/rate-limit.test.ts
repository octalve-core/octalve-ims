import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Redis-backed limiter used to check (ZCARD) and record (ZADD) in separate round trips,
 * so concurrent requests could all read "under the limit" before any of them added their
 * entry — a burst could race past the configured limit. It's now one atomic Lua script (one
 * EVAL), closing that race. Still fails open (allows the request) when Redis is absent or the
 * script errors — that's a deliberate, unchanged tradeoff for ordinary API routes (see
 * lib/api/rate-limit.ts), not part of this fix.
 */

const { getRedis } = vi.hoisted(() => ({ getRedis: vi.fn() }));
vi.mock("./redis", () => ({ getRedis }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { checkRateLimit } from "./rate-limit";

function fakeRedis(evalResult: unknown) {
  const evalFn = vi.fn().mockResolvedValue(evalResult);
  return {
    evalFn,
    client: {
      eval: evalFn,
      // If the implementation ever falls back to these, that's the bug this test guards
      // against — present so a wrong call surfaces as "not a function" rather than silently
      // no-op-ing.
      zremrangebyscore: undefined,
      zcard: undefined,
      zadd: undefined,
      zrange: undefined,
      expire: undefined,
    },
  };
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    getRedis.mockReset();
  });

  it("makes exactly one atomic round trip (EVAL), not separate check-then-record calls", async () => {
    const { client, evalFn } = fakeRedis([1, 3, 0]);
    getRedis.mockReturnValue(client);

    await checkRateLimit({ limit: 10, window: 60, identifier: "ip:1.2.3.4" });

    expect(evalFn).toHaveBeenCalledTimes(1);
    const [script, keys] = evalFn.mock.calls[0]!;
    expect(script).toContain("ZCARD");
    expect(keys).toEqual(["rate-limit:ip:1.2.3.4"]);
  });

  it("allows the request and reports the new count when the script says allowed", async () => {
    const { client } = fakeRedis([1, 4, 0]);
    getRedis.mockReturnValue(client);

    const result = await checkRateLimit({ limit: 10, window: 60, identifier: "ip:1.2.3.4" });

    expect(result).toEqual({ allowed: true, current: 4, limit: 10, reset: 60 });
  });

  it("rejects the request and derives reset from the oldest entry's score when over the limit", async () => {
    const now = Date.now();
    const oldestScore = now - 45_000; // entered 45s into a 60s window
    const { client } = fakeRedis([0, 10, oldestScore]);
    getRedis.mockReturnValue(client);
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await checkRateLimit({ limit: 10, window: 60, identifier: "ip:1.2.3.4" });

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.reset).toBe(15); // 60s window - 45s elapsed
    vi.restoreAllMocks();
  });

  it("fails open when Redis is not configured", async () => {
    getRedis.mockReturnValue(null);

    const result = await checkRateLimit({ limit: 10, window: 60, identifier: "ip:1.2.3.4" });

    expect(result.allowed).toBe(true);
  });

  it("fails open when the script call errors", async () => {
    const client = { eval: vi.fn().mockRejectedValue(new Error("redis down")) };
    getRedis.mockReturnValue(client);

    const result = await checkRateLimit({ limit: 10, window: 60, identifier: "ip:1.2.3.4" });

    expect(result.allowed).toBe(true);
  });
});

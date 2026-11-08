import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0070 — validateEnv() existed but nothing ever called it, so a
 * deployment missing a required env var only surfaced as a confusing
 * failure on whichever request first needed it, not at startup.
 */

const { validateEnv, initializeRedis, isRedisConfigured, initializeQStash } = vi.hoisted(() => ({
  validateEnv: vi.fn(),
  initializeRedis: vi.fn(),
  isRedisConfigured: vi.fn(() => false),
  initializeQStash: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ validateEnv }));
vi.mock("@/lib/cache/redis", () => ({ initializeRedis, isRedisConfigured, getRedis: vi.fn() }));
vi.mock("@/lib/queue/qstash", () => ({ initializeQStash }));
vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("instrumentation register()", () => {
  it("calls validateEnv() on the nodejs runtime, unguarded by try/catch", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("./instrumentation");
    await register();
    expect(validateEnv).toHaveBeenCalledTimes(1);
    process.env.NEXT_RUNTIME = original;
  });

  it("propagates a validateEnv() failure instead of swallowing it", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    validateEnv.mockImplementation(() => {
      throw new Error("Missing required environment variables:\n  - JWT_SECRET");
    });
    const { register } = await import("./instrumentation");
    await expect(register()).rejects.toThrow(/Missing required environment variables/);
    process.env.NEXT_RUNTIME = original;
  });

  it("does not call validateEnv() on the edge runtime", async () => {
    const original = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("./instrumentation");
    await register();
    expect(validateEnv).not.toHaveBeenCalled();
    process.env.NEXT_RUNTIME = original;
  });
});

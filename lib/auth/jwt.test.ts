import { afterEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "./jwt";

/**
 * ISS-0070 — JWT_SECRET had no minimum-strength check: a short production
 * secret (HS256 treats it as the signing key) would be silently accepted.
 * getSecret() reads process.env on every call, so no module-cache dance is
 * needed between cases.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("JWT secret strength (production)", () => {
  it("rejects a short secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "too-short");
    await expect(signAccessToken({ sub: "u1", role: "admin" })).rejects.toThrow(
      /at least 32 characters/,
    );
  });

  it("accepts a secret at least 32 characters long in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(32));
    await expect(signAccessToken({ sub: "u1", role: "admin" })).resolves.toBeTypeOf(
      "string",
    );
  });

  it("still throws (unrelated, pre-existing check) when unset in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", undefined);
    await expect(signAccessToken({ sub: "u1", role: "admin" })).rejects.toThrow(
      /must be set in production/,
    );
  });

  it("does not enforce the length minimum outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "short");
    await expect(signAccessToken({ sub: "u1", role: "admin" })).resolves.toBeTypeOf(
      "string",
    );
  });
});

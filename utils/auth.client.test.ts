import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0050: a 5xx or a network blip from /api/auth/session used to be treated
 * identically to a real 401/403 (anything non-OK -> null), so a transient
 * failure logged every signed-in user out client-side. Only a definite
 * 401/403 should resolve to "no session" — anything else is indeterminate
 * and must not be mistaken for a sign-out by callers.
 */

import { getSessionClient } from "./auth.client";

describe("getSessionClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the user on a 200", async () => {
    const user = { id: "u1", name: "A", email: "a@example.com" };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => user,
    });

    await expect(getSessionClient()).resolves.toEqual(user);
  });

  it("returns null on a 401 (a real sign-out)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(getSessionClient()).resolves.toBeNull();
  });

  it("returns null on a 403", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(getSessionClient()).resolves.toBeNull();
  });

  it("returns \"indeterminate\" on a 500 — not a sign-out", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(getSessionClient()).resolves.toBe("indeterminate");
  });

  it("returns \"indeterminate\" on a network error — not a sign-out", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );

    await expect(getSessionClient()).resolves.toBe("indeterminate");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Still-open item from task 0004: access tokens carried no jti and nothing could invalidate
 * one already issued, so logout/change-password/reset-password's existing "revoke every
 * refresh token" only stopped a device from getting a NEW access token — the access token it
 * already held kept working until its own 15-minute expiry. `User.tokensRevokedAt` plus this
 * check close that window: every access token now carries a `jti` (for identity/audit) and is
 * rejected here once it was issued (`iat`) before the user's last "log out everywhere" event,
 * everywhere that event already revokes refresh tokens.
 */

const { findUnique, verifyToken } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("@/prisma/client", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/lib/auth/jwt", () => ({ verifyToken }));

import { getSessionFromRequest } from "./auth";

function request(token = "a-token") {
  return { cookies: { get: () => ({ value: token }) } };
}

describe("getSessionFromRequest", () => {
  beforeEach(() => {
    findUnique.mockReset();
    verifyToken.mockReset();
  });

  it("returns the user when the token is valid and nothing was ever revoked", async () => {
    verifyToken.mockResolvedValue({ sub: "u1", role: "user", jti: "t1", iat: 1000 });
    findUnique.mockResolvedValue({ id: "u1", tokensRevokedAt: null });

    const user = await getSessionFromRequest(request());

    expect(user).toEqual({ id: "u1", tokensRevokedAt: null });
  });

  it("rejects a token issued before the user's last log-out-everywhere event", async () => {
    verifyToken.mockResolvedValue({ sub: "u1", role: "user", jti: "t1", iat: 1000 });
    findUnique.mockResolvedValue({ id: "u1", tokensRevokedAt: new Date(1000 * 1000 + 1) });

    const user = await getSessionFromRequest(request());

    expect(user).toBeNull();
  });

  it("accepts a token issued after the user's last log-out-everywhere event", async () => {
    verifyToken.mockResolvedValue({ sub: "u1", role: "user", jti: "t2", iat: 2000 });
    findUnique.mockResolvedValue({ id: "u1", tokensRevokedAt: new Date(1000 * 1000) });

    const user = await getSessionFromRequest(request());

    expect(user).toEqual({ id: "u1", tokensRevokedAt: new Date(1000 * 1000) });
  });

  it("returns null when there's no cookie, or the token doesn't verify", async () => {
    expect(await getSessionFromRequest({ cookies: { get: () => undefined } })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();

    verifyToken.mockResolvedValue(null);
    expect(await getSessionFromRequest(request())).toBeNull();
  });
});

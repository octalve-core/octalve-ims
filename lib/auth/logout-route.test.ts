import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0033: logout used to revoke the user's refresh tokens only if the access token was still
 * valid. An idle tab past 15 minutes looked signed out (the cookies were cleared) while the
 * refresh token stayed usable in the database for up to 30 days.
 */

const { cookieJar, cookieDeletes, updateMany } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  cookieDeletes: [] as string[],
  updateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined),
    set: vi.fn(),
    delete: (o: { name: string } | string) =>
      cookieDeletes.push(typeof o === "string" ? o : o.name),
  }),
}));
vi.mock("@/prisma/client", () => ({ prisma: { refreshToken: { updateMany } } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "@/app/api/auth/logout/route";

const SECRET = new TextEncoder().encode("dev_octalve_ims_jwt_secret_only_for_local_testing");

async function accessToken(opts: { expiresInSeconds: number; secret?: Uint8Array; sub?: string }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: opts.sub ?? "u1", role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 3600)
    .setExpirationTime(now + opts.expiresInSeconds)
    .sign(opts.secret ?? SECRET);
}

const request = () =>
  new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });

beforeEach(() => {
  cookieJar.clear();
  cookieDeletes.length = 0;
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("logout revokes the refresh tokens", () => {
  it("with a valid access token", async () => {
    cookieJar.set("access_token", await accessToken({ expiresInSeconds: 600 }));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("with an access token that expired while the tab sat idle (ISS-0033)", async () => {
    cookieJar.set("access_token", await accessToken({ expiresInSeconds: -120 }));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(cookieDeletes.sort()).toEqual(["access_token", "refresh_token"]);
  });
});

describe("logout does not trust a token it cannot verify", () => {
  it("revokes nothing for a token signed with another key, but still clears the cookies", async () => {
    cookieJar.set(
      "access_token",
      await accessToken({
        expiresInSeconds: -120,
        secret: new TextEncoder().encode("some-other-secret-value-xxxxxxxxxxxx"),
        sub: "victim",
      }),
    );
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(updateMany).not.toHaveBeenCalled();
    expect(cookieDeletes.sort()).toEqual(["access_token", "refresh_token"]);
  });

  it("revokes nothing for a malformed token or no token", async () => {
    cookieJar.set("access_token", "not-a-jwt");
    await POST(request());
    cookieJar.delete("access_token");
    await POST(request());
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin request", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { origin: "http://evil.example", host: "localhost" },
      }),
    );
    expect(res.status).toBe(403);
  });
});

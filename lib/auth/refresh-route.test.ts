import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0028 (a refresh that loses a race, or whose response never reached the browser, logged the
 * user out everywhere) and ISS-0029 (every rotation reset the session to 7 days, so "keep me
 * signed in" off or on both ended at 7 and a stolen rotating token never expired).
 */

type Token = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revokedAt: Date | null;
  replacedBy: string | null;
  expiresAt: Date;
  user: { id: string; role: string | null; status: string };
};

const { cookieJar, cookieWrites, cookieDeletes, db, reserve, release } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  cookieWrites: [] as { name: string; value: string; maxAge?: number }[],
  cookieDeletes: [] as string[],
  db: { updateMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  reserve: vi.fn(),
  release: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined),
    set: (name: string, value: string, o: { maxAge?: number }) =>
      cookieWrites.push({ name, value, maxAge: o.maxAge }),
    delete: (o: { name: string } | string) =>
      cookieDeletes.push(typeof o === "string" ? o : o.name),
  }),
}));
vi.mock("@/prisma/client", () => ({
  prisma: {
    refreshToken: db,
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: async () => null,
  defaultRateLimits: { auth: {} },
}));
vi.mock("@/lib/auth/rate-limit-db", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/rate-limit-db")>()),
  reserveAttempt: (...a: unknown[]) => reserve(...a),
  releaseAttempt: (...a: unknown[]) => release(...a),
}));

import { POST } from "@/app/api/auth/refresh/route";
import { ACCOUNT_STATUS } from "@/lib/auth/account-status";

const hash = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
const DAY = 24 * 60 * 60 * 1000;

function request() {
  return new NextRequest("http://localhost/api/auth/refresh", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });
}

function tokenRow(over: Partial<Token> = {}): Token {
  return {
    id: "t1",
    userId: "u1",
    tokenHash: hash("old-token"),
    familyId: "fam",
    revokedAt: null,
    replacedBy: null,
    expiresAt: new Date(Date.now() + 25 * DAY),
    user: { id: "u1", role: "user", status: ACCOUNT_STATUS.ACTIVE },
    ...over,
  };
}

beforeEach(() => {
  cookieJar.clear();
  cookieWrites.length = 0;
  cookieDeletes.length = 0;
  vi.clearAllMocks();
  db.create.mockResolvedValue({});
  cookieJar.set("refresh_token", "old-token");
  reserve.mockResolvedValue({ allowed: true, attemptId: "att1", remaining: 29 });
  release.mockResolvedValue(undefined);
});

describe("refresh: rotation keeps the session's own length (ISS-0029)", () => {
  it("gives the new token the old token's expiry, and the cookie the time that is left", async () => {
    const old = tokenRow({ expiresAt: new Date(Date.now() + 25 * DAY) });
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(old);

    const res = await POST(request());
    expect(res.status).toBe(200);

    const created = db.create.mock.calls[0]![0].data;
    expect(created.expiresAt.getTime()).toBe(old.expiresAt.getTime());
    expect(created.familyId).toBe("fam");

    const refreshCookie = cookieWrites.find((c) => c.name === "refresh_token")!;
    expect(refreshCookie.maxAge).toBeGreaterThan(24 * 24 * 60 * 60);
    expect(refreshCookie.maxAge).toBeLessThanOrEqual(25 * 24 * 60 * 60);
  });

  it("does not stretch a one-day session to seven", async () => {
    const old = tokenRow({ expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000) });
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(old);
    await POST(request());
    expect(db.create.mock.calls[0]![0].data.expiresAt.getTime()).toBe(old.expiresAt.getTime());
    expect(cookieWrites.find((c) => c.name === "refresh_token")!.maxAge).toBeLessThan(24 * 60 * 60);
  });

  it("records the replacement on the old token in the same atomic update", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(tokenRow());
    await POST(request());
    const first = db.updateMany.mock.calls[0]![0];
    expect(first.data.revokedAt).toBeInstanceOf(Date);
    expect(first.data.replacedBy).toBe(hash(cookieWrites.find((c) => c.name === "refresh_token")!.value));
  });
});

describe("refresh: a token used twice (ISS-0028)", () => {
  it("accepts the old value once more when it was rotated moments ago, and issues a fresh pair", async () => {
    const rotated = tokenRow({
      revokedAt: new Date(Date.now() - 1_000),
      replacedBy: "successor-hash",
    });
    db.updateMany
      .mockResolvedValueOnce({ count: 0 }) // the rotation: already revoked
      .mockResolvedValueOnce({ count: 1 }) // claim of the successor
      .mockResolvedValue({ count: 1 });
    db.findUnique.mockResolvedValueOnce(rotated).mockResolvedValueOnce(rotated);

    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(cookieWrites.map((c) => c.name).sort()).toEqual(["access_token", "refresh_token"]);
    expect(cookieDeletes).toEqual([]);
  });

  it("answers a second retry in the window with 401 and leaves the family and the cookies alone", async () => {
    const rotated = tokenRow({ revokedAt: new Date(Date.now() - 1_000), replacedBy: "successor-hash" });
    db.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 }); // successor already claimed
    db.findUnique.mockResolvedValueOnce(rotated);

    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(cookieDeletes).toEqual([]);
    expect(cookieWrites).toEqual([]);
    expect(db.updateMany).toHaveBeenCalledTimes(2); // no family-wide revoke
  });

  it("treats a replay after the window as theft: the whole family is revoked", async () => {
    const stale = tokenRow({ revokedAt: new Date(Date.now() - 60_000), replacedBy: "successor-hash" });
    db.updateMany.mockResolvedValue({ count: 0 });
    db.findUnique.mockResolvedValueOnce(stale);

    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(db.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: "fam" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(cookieDeletes.sort()).toEqual(["access_token", "refresh_token"]);
  });
});

describe("refresh: account status (decision a)", () => {
  it("refuses a SUSPENDED account, revokes the whole family, and clears cookies", async () => {
    const suspended = tokenRow({ user: { id: "u1", role: "user", status: ACCOUNT_STATUS.SUSPENDED } });
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(suspended);

    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(db.create).not.toHaveBeenCalled();
    expect(cookieDeletes.sort()).toEqual(["access_token", "refresh_token"]);
    expect(db.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: "fam" },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("refuses a PENDING_VERIFICATION account the same way, defensively", async () => {
    const pending = tokenRow({
      user: { id: "u1", role: "user", status: ACCOUNT_STATUS.PENDING_VERIFICATION },
    });
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(pending);

    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("does not spend the refresh rate-limit budget when blocked by status", async () => {
    const suspended = tokenRow({ user: { id: "u1", role: "user", status: ACCOUNT_STATUS.SUSPENDED } });
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(suspended);
    await POST(request());
    expect(release).not.toHaveBeenCalled();
  });

  it("still refreshes an ACTIVE account normally", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(tokenRow());
    const res = await POST(request());
    expect(res.status).toBe(200);
  });
});

describe("refresh: throttling (ISS-0027)", () => {
  it("answers a visitor with no refresh cookie without spending any of the budget", async () => {
    cookieJar.delete("refresh_token");
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("refuses with 429 once the address has used its budget", async () => {
    reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 30 });
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it("uses the wide refresh budget and hands the slot back on success", async () => {
    db.updateMany.mockResolvedValueOnce({ count: 1 });
    db.findUnique.mockResolvedValueOnce(tokenRow());
    await POST(request());
    expect(reserve).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/), 30);
    expect(release).toHaveBeenCalledWith("att1");
  });
});

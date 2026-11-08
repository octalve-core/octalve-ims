import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0027: the auth routes used to share the Redis limiter, which allows everything when Redis is
 * missing, and keyed login by email alone. This is the database-backed limiter that replaces it
 * for those routes. The Prisma client is replaced by an in-memory LoginAttempt table.
 */

type Row = { id: string; identifier: string; userId?: string; createdAt: Date };
let rows: Row[] = [];
let nextId = 1;
const locks: string[] = [];

const tx = {
  $executeRaw: vi.fn(async (_s: TemplateStringsArray, ...values: unknown[]) => {
    locks.push(String(values[0]));
  }),
  loginAttempt: {
    deleteMany: vi.fn(async ({ where }: { where: { identifier: string; createdAt: { lte: Date } } }) => {
      rows = rows.filter(
        (r) => !(r.identifier === where.identifier && r.createdAt <= where.createdAt.lte),
      );
    }),
    count: vi.fn(async ({ where }: { where: { identifier: string; createdAt: { gt: Date } } }) =>
      rows.filter((r) => r.identifier === where.identifier && r.createdAt > where.createdAt.gt).length,
    ),
    findFirst: vi.fn(async ({ where }: { where: { identifier: string; createdAt: { gt: Date } } }) => {
      const hit = rows
        .filter((r) => r.identifier === where.identifier && r.createdAt > where.createdAt.gt)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      return hit ? { createdAt: hit.createdAt } : null;
    }),
    create: vi.fn(async ({ data }: { data: { identifier: string; userId?: string } }) => {
      const row = { id: `a${nextId++}`, identifier: data.identifier, userId: data.userId, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  },
};

vi.mock("@/prisma/client", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    loginAttempt: {
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const before = rows.length;
        rows = rows.filter((r) => r.id !== where.id);
        if (rows.length === before) throw new Error("not found");
      }),
    },
  },
}));

import { getClientIp, releaseAttempt, reserveAttempt } from "./rate-limit-db";

beforeEach(() => {
  rows = [];
  nextId = 1;
  locks.length = 0;
});

describe("reserveAttempt", () => {
  it("allows up to the limit inside the window, then refuses with a retry time", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await reserveAttempt("ip:1.1.1.1", 3)).allowed).toBe(true);
    }
    const refused = await reserveAttempt("ip:1.1.1.1", 3);
    expect(refused.allowed).toBe(false);
    expect(refused.attemptId).toBeNull();
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(rows).toHaveLength(3);
  });

  it("keeps each identifier's budget separate", async () => {
    await reserveAttempt("a", 1);
    expect((await reserveAttempt("a", 1)).allowed).toBe(false);
    expect((await reserveAttempt("b", 1)).allowed).toBe(true);
  });

  it("takes the advisory lock for the identifier before counting", async () => {
    await reserveAttempt("login-account/x@y.com", 5);
    expect(locks).toEqual(["login-account/x@y.com"]);
  });

  it("forgets attempts older than the window", async () => {
    rows.push({ id: "old", identifier: "k", createdAt: new Date(Date.now() - 10 * 60 * 1000) });
    const r = await reserveAttempt("k", 1);
    expect(r.allowed).toBe(true);
    expect(rows.find((x) => x.id === "old")).toBeUndefined();
  });

  it("gives a slot back when the attempt is released", async () => {
    const first = await reserveAttempt("k", 1);
    expect((await reserveAttempt("k", 1)).allowed).toBe(false);
    await releaseAttempt(first.attemptId);
    expect((await reserveAttempt("k", 1)).allowed).toBe(true);
  });

  it("releasing nothing, or something already gone, does not throw", async () => {
    await expect(releaseAttempt(null)).resolves.toBeUndefined();
    await expect(releaseAttempt("missing")).resolves.toBeUndefined();
  });
});

describe("getClientIp", () => {
  const req = (h: Record<string, string>) => ({
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
  });

  it("trusts the last forwarded hop, not the client-supplied first one", () => {
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip and then to localhost", () => {
    expect(getClientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(getClientIp(req({}))).toBe("127.0.0.1");
  });
});

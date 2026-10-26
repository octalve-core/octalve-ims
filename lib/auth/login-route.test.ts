import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0027 (login was limited per email only: password spraying across emails was free, a
 * stranger could lock a victim out, and successes counted) and ISS-0032 (an unknown email skipped
 * the password check, so the response time told an attacker which emails have accounts).
 */

const { cookieWrites, findUnique, createToken, reserve, release } = vi.hoisted(() => ({
  cookieWrites: [] as { name: string; maxAge?: number }[],
  findUnique: vi.fn(),
  createToken: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, _v: string, o: { maxAge?: number }) =>
      cookieWrites.push({ name, maxAge: o.maxAge }),
    delete: vi.fn(),
  }),
}));
vi.mock("@/prisma/client", () => ({
  prisma: { user: { findUnique }, refreshToken: { create: createToken } },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/auth/rate-limit-db", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/rate-limit-db")>()),
  reserveAttempt: (...a: unknown[]) => reserve(...a),
  releaseAttempt: (...a: unknown[]) => release(...a),
}));

import { POST } from "@/app/api/auth/login/route";

function request(body: unknown, ip = "203.0.113.7") {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

let realHash = "";
beforeEach(async () => {
  vi.clearAllMocks();
  cookieWrites.length = 0;
  realHash = realHash || (await bcrypt.hash("correct-horse", 4));
  createToken.mockResolvedValue({});
  reserve.mockImplementation(async (id: string) => ({
    allowed: true,
    attemptId: `att:${id}`,
    remaining: 4,
  }));
  release.mockResolvedValue(undefined);
});

const user = () => ({ id: "u1", email: "a@b.com", name: "A", role: "user", password: realHash });

describe("login throttling (ISS-0027)", () => {
  it("counts per address and email, and across all addresses for the account", async () => {
    findUnique.mockResolvedValue(user());
    await POST(request({ email: "a@b.com", password: "correct-horse" }));
    expect(reserve).toHaveBeenCalledWith("login:203.0.113.7:a@b.com");
    expect(reserve).toHaveBeenCalledWith("login-account/a@b.com", 30);
  });

  it("refuses with 429 before any password check when the address and email are used up", async () => {
    reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 90 });
    const spy = vi.spyOn(bcrypt, "compare");
    const res = await POST(request({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(429);
    expect(spy).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("refuses when the account's all-address budget is used, and hands the first slot back", async () => {
    reserve
      .mockResolvedValueOnce({ allowed: true, attemptId: "att-ip", remaining: 4 })
      .mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 60 });
    const res = await POST(request({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(429);
    expect(release).toHaveBeenCalledWith("att-ip");
  });

  it("does not let a spoofed first X-Forwarded-For entry change the address that is counted", async () => {
    findUnique.mockResolvedValue(user());
    await POST(request({ email: "a@b.com", password: "correct-horse" }, "6.6.6.6, 203.0.113.7"));
    expect(reserve).toHaveBeenCalledWith("login:203.0.113.7:a@b.com");
  });

  it("gives both slots back on a good password, and keeps them on a bad one", async () => {
    findUnique.mockResolvedValue(user());
    await POST(request({ email: "a@b.com", password: "correct-horse" }));
    expect(release).toHaveBeenCalledWith("att:login:203.0.113.7:a@b.com");
    expect(release).toHaveBeenCalledWith("att:login-account/a@b.com");

    release.mockClear();
    const bad = await POST(request({ email: "a@b.com", password: "wrong" }));
    expect(bad.status).toBe(401);
    expect(release).not.toHaveBeenCalled();
  });
});

describe("login timing (ISS-0032)", () => {
  it("still compares the password against a hash when the email is unknown", async () => {
    findUnique.mockResolvedValue(null);
    const spy = vi.spyOn(bcrypt, "compare");
    const res = await POST(request({ email: "nobody@b.com", password: "whatever" }));
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1]).toMatch(/^\$2[aby]\$12\$/);
  });

  it("does the same for an account that has no password (sign-in with Google only)", async () => {
    findUnique.mockResolvedValue({ ...user(), password: null });
    const spy = vi.spyOn(bcrypt, "compare");
    const res = await POST(request({ email: "a@b.com", password: "whatever" }));
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("answers an unknown email and a wrong password identically", async () => {
    findUnique.mockResolvedValueOnce(null);
    const unknown = await POST(request({ email: "nobody@b.com", password: "x" }));
    findUnique.mockResolvedValueOnce(user());
    const wrong = await POST(request({ email: "a@b.com", password: "x" }));
    expect(unknown.status).toBe(wrong.status);
    expect(await unknown.json()).toEqual(await wrong.json());
  });
});

describe("login session length", () => {
  it("is 30 days with 'keep me signed in', 1 day without", async () => {
    findUnique.mockResolvedValue(user());
    await POST(request({ email: "a@b.com", password: "correct-horse", rememberMe: true }));
    expect(createToken.mock.calls[0]![0].data.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      29 * 24 * 60 * 60 * 1000,
    );
    await POST(request({ email: "a@b.com", password: "correct-horse", rememberMe: false }));
    expect(createToken.mock.calls[1]![0].data.expiresAt.getTime() - Date.now()).toBeLessThan(
      25 * 60 * 60 * 1000,
    );
  });
});

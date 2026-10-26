import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0027 (forgot-password was limited per email only, so one inbox could be flooded and one
 * address could ask for any number of different emails; reset-password and change-password had no
 * useful limit), ISS-0032 (forgot-password's response time, and the logged raw email, told an
 * attacker which emails have accounts; register leaked database error text), and the reset token
 * being read and deleted in separate steps so two requests could both use it.
 */

const h = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  scheduled: [] as (() => Promise<unknown> | unknown)[],
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  resetUpsert: vi.fn(),
  resetDeleteMany: vi.fn(),
  resetFindUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
  sendEmail: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<unknown> | unknown) => h.scheduled.push(fn),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (h.cookieJar.has(n) ? { value: h.cookieJar.get(n) } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("@/prisma/client", () => {
  const tx = {
    passwordResetToken: { findUnique: h.resetFindUnique, deleteMany: h.resetDeleteMany },
    user: { update: h.userUpdate },
    refreshToken: { updateMany: h.tokenUpdateMany },
  };
  return {
    prisma: {
      user: {
        findUnique: h.userFindUnique,
        findFirst: h.userFindFirst,
        create: h.userCreate,
        update: h.userUpdate,
      },
      passwordResetToken: {
        upsert: h.resetUpsert,
        findUnique: h.resetFindUnique,
        deleteMany: h.resetDeleteMany,
      },
      refreshToken: { create: h.tokenCreate, updateMany: h.tokenUpdateMany },
      $transaction: async (arg: unknown) =>
        typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as []),
    },
  };
});
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: h.logInfo },
}));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateAuthCaches: vi.fn() }));
vi.mock("@/lib/email/brevo", () => ({
  isBrevoConfigured: () => true,
  sendEmailViaBrevo: h.sendEmail,
}));
vi.mock("@/lib/auth/rate-limit-db", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/rate-limit-db")>()),
  reserveAttempt: (...a: unknown[]) => h.reserve(...a),
  releaseAttempt: (...a: unknown[]) => h.release(...a),
}));

import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { POST as change } from "@/app/api/auth/change-password/route";
import { POST as register } from "@/app/api/auth/register/route";

function req(path: string, body: unknown, ip = "203.0.113.7") {
  return new NextRequest(`http://localhost/api/auth/${path}`, {
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

async function signedIn(sub = "u1") {
  const secret = new TextEncoder().encode("dev_octalve_ims_jwt_secret_only_for_local_testing");
  h.cookieJar.set(
    "access_token",
    await new SignJWT({ sub, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(secret),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.cookieJar.clear();
  h.scheduled.length = 0;
  h.reserve.mockImplementation(async (id: string) => ({
    allowed: true,
    attemptId: `att:${id}`,
    remaining: 4,
  }));
  h.release.mockResolvedValue(undefined);
  h.sendEmail.mockResolvedValue({ success: true });
  h.resetUpsert.mockResolvedValue({});
  h.tokenUpdateMany.mockResolvedValue({ count: 1 });
  h.userUpdate.mockResolvedValue({});
});

describe("forgot-password", () => {
  const realUser = { id: "u1", email: "a@b.com", name: "A", password: "hash" };

  it("answers a real and an unknown email the same way, with the user lookup after the response", async () => {
    h.userFindUnique.mockResolvedValue(realUser);
    const known = await forgot(req("forgot-password", { email: "a@b.com" }));
    h.userFindUnique.mockResolvedValue(null);
    const unknown = await forgot(req("forgot-password", { email: "nobody@b.com" }));
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
    // Nothing that differs between the two cases ran before the response went out.
    expect(h.userFindUnique).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.scheduled).toHaveLength(2);
  });

  it("then makes the token and sends the email only for a real account", async () => {
    h.userFindUnique.mockResolvedValueOnce(realUser).mockResolvedValueOnce(null);
    await forgot(req("forgot-password", { email: "a@b.com" }));
    await forgot(req("forgot-password", { email: "nobody@b.com" }));
    for (const job of h.scheduled) await job();
    expect(h.resetUpsert).toHaveBeenCalledTimes(1);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not write the email address to the log for an unknown account", async () => {
    h.userFindUnique.mockResolvedValue(null);
    await forgot(req("forgot-password", { email: "nobody@b.com" }));
    for (const job of h.scheduled) await job();
    expect(JSON.stringify(h.logInfo.mock.calls)).not.toContain("nobody@b.com");
  });

  it("is limited per address and email, and per email across every address (ISS-0027)", async () => {
    await forgot(req("forgot-password", { email: "A@b.com" }));
    expect(h.reserve).toHaveBeenCalledWith("forgot:203.0.113.7:a@b.com");
    expect(h.reserve).toHaveBeenCalledWith("forgot-account/a@b.com", 5, 60 * 60 * 1000);
    h.reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 5 });
    expect((await forgot(req("forgot-password", { email: "a@b.com" }))).status).toBe(429);
  });
});

describe("reset-password", () => {
  const body = { token: "raw-token", password: "a-new-password" };
  const record = () =>
    h.resetFindUnique.mockResolvedValue({
      id: "r1",
      userId: "u1",
      expiresAt: new Date(Date.now() + 60_000),
    });

  it("uses a token once: the second of two simultaneous requests is refused", async () => {
    record();
    h.resetDeleteMany.mockResolvedValueOnce({ count: 0 }); // the other request deleted it first
    const res = await reset(req("reset-password", body));
    expect(res.status).toBe(400);
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.tokenUpdateMany).not.toHaveBeenCalled();
  });

  it("claims the token by deleting it, then changes the password and signs everyone out", async () => {
    record();
    h.resetDeleteMany.mockResolvedValueOnce({ count: 1 });
    const res = await reset(req("reset-password", body));
    expect(res.status).toBe(200);
    expect(h.resetDeleteMany.mock.calls[0]![0].where).toEqual({
      id: "r1",
      expiresAt: { gt: expect.any(Date) },
    });
    expect(h.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
    expect(h.tokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("refuses an unknown or expired token", async () => {
    h.resetFindUnique.mockResolvedValue(null);
    expect((await reset(req("reset-password", body))).status).toBe(400);
    h.resetFindUnique.mockResolvedValue({ id: "r1", userId: "u1", expiresAt: new Date(Date.now() - 1) });
    expect((await reset(req("reset-password", body))).status).toBe(400);
    expect(h.resetDeleteMany).not.toHaveBeenCalled();
  });

  it("is limited per address (ISS-0027)", async () => {
    h.reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 5 });
    const res = await reset(req("reset-password", body));
    expect(res.status).toBe(429);
    expect(h.reserve).toHaveBeenCalledWith("reset:203.0.113.7");
  });
});

describe("change-password", () => {
  const body = { currentPassword: "old-password", newPassword: "a-new-password" };

  it("limits guesses at the current password per signed-in user (ISS-0027)", async () => {
    await signedIn("u1");
    h.reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 5 });
    const res = await change(req("change-password", body));
    expect(res.status).toBe(429);
    expect(h.reserve).toHaveBeenCalledWith("change-password:u1");
    expect(h.userFindUnique).not.toHaveBeenCalled();
  });

  it("keeps the slot after a wrong current password, and hands it back after a right one", async () => {
    await signedIn("u1");
    const hash = await bcrypt.hash("old-password", 4);
    h.userFindUnique.mockResolvedValue({ id: "u1", password: hash });
    const wrong = await change(req("change-password", { ...body, currentPassword: "nope-nope" }));
    expect(wrong.status).toBe(400);
    expect(h.release).not.toHaveBeenCalled();
    const ok = await change(req("change-password", body));
    expect(ok.status).toBe(200);
    expect(h.release).toHaveBeenCalledWith("att:change-password:u1");
  });
});

describe("register", () => {
  it("is limited per address (ISS-0027) and never echoes database error text (ISS-0032)", async () => {
    h.userFindUnique.mockResolvedValue(null);
    h.userFindFirst.mockResolvedValue(null);
    h.userCreate.mockRejectedValue(new Error('Invalid `prisma.user.create()` invocation: secret detail'));
    const res = await register(
      req("register", { name: "Ada", email: "ada@b.com", password: "a-good-password" }),
    );
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
    expect(h.reserve).toHaveBeenCalledWith("register:203.0.113.7");

    h.reserve.mockResolvedValueOnce({ allowed: false, attemptId: null, remaining: 0, retryAfterSeconds: 5 });
    const limited = await register(
      req("register", { name: "Ada", email: "ada@b.com", password: "a-good-password" }),
    );
    expect(limited.status).toBe(429);
  });
});

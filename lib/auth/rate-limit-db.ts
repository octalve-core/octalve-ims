import { prisma } from "@/prisma/client";

/**
 * Database-backed limiter for the auth routes (ISS-0027), ported from Proplity's
 * lib/auth/rateLimit.ts. The Redis limiter in lib/cache/rate-limit.ts allows every request when
 * Redis is absent or errors, and its check and write are separate calls; that is fine for
 * ordinary API traffic but not for credential guessing, so login, refresh, register, the password
 * routes and change-password use this one. It needs only the `LoginAttempt` table, so it works the
 * same on every deployment and cannot silently switch itself off.
 */

const WINDOW_MS = 5 * 60 * 1000;
export const AUTH_MAX_ATTEMPTS = 5;
/** Per-account budget across all addresses: higher, so one person's guesses cannot lock a victim out. */
export const ACCOUNT_MAX_ATTEMPTS = 30;
/**
 * Refresh is not credential guessing (the secret is a 256-bit token) but a background call every
 * open tab makes about every 13 minutes, so several people behind one office address legitimately
 * exceed the login budget.
 */
export const REFRESH_MAX_ATTEMPTS = 30;

// Callers sharing an identifier queue on the advisory lock, so a transaction can legitimately wait
// on those ahead of it; Prisma's default 5 s timeout would surface as a 500 under a burst.
const TX_OPTIONS = { timeout: 20_000, maxWait: 20_000 } as const;

export type Reservation = {
  allowed: boolean;
  attemptId: string | null;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * Atomically checks and reserves a slot in a sliding window, under a per-identifier Postgres
 * advisory lock so concurrent requests cannot all pass the count before any has recorded itself.
 * Call before any slow work. A caller whose request turned out not to need counting (a login that
 * succeeded) hands the id back to `releaseAttempt`, so only failures count against the window.
 */
export async function reserveAttempt(
  identifier: string,
  maxAttempts: number = AUTH_MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
  userId?: string,
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`;

    const now = Date.now();
    const windowStart = new Date(now - windowMs);
    await tx.loginAttempt.deleteMany({ where: { identifier, createdAt: { lte: windowStart } } });
    const count = await tx.loginAttempt.count({
      where: { identifier, createdAt: { gt: windowStart } },
    });

    if (count >= maxAttempts) {
      const oldest = await tx.loginAttempt.findFirst({
        where: { identifier, createdAt: { gt: windowStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const resetAt = (oldest ? oldest.createdAt.getTime() : windowStart.getTime()) + windowMs;
      return {
        allowed: false,
        attemptId: null,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    const attempt = await tx.loginAttempt.create({ data: { identifier, userId } });
    return {
      allowed: true,
      attemptId: attempt.id,
      remaining: Math.max(0, maxAttempts - count - 1),
    };
  }, TX_OPTIONS);
}

/** Gives back a reservation that turned out not to count (for example, the login succeeded). */
export async function releaseAttempt(attemptId: string | null): Promise<void> {
  if (!attemptId) return;
  await prisma.loginAttempt.delete({ where: { id: attemptId } }).catch(() => {});
}

/** The standard 429 body the auth routes answer with. */
export function tooManyAttempts(reservation: Reservation) {
  return {
    error: "Too many attempts. Try again later.",
    retryAfter: reservation.retryAfterSeconds,
  };
}

/**
 * The caller's address. X-Forwarded-For is "client, proxy1, proxy2, ...", each hop appending the
 * address it saw, so the first entry is whatever the client sent (trivially spoofed) and the last
 * is what the nearest trusted proxy saw. The app runs behind exactly one trusted hop (Vercel), so
 * the last entry is the one to trust. Behind more proxies this needs revisiting.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const raw = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1";
  const hops = raw.split(",").map((h) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] ?? "127.0.0.1";
}

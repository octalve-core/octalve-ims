/**
 * Authentication utilities: password hashing and full-User session resolution.
 * Used by API routes (getSessionFromRequest) and client (getSessionClient via /api/auth/session).
 *
 * JWT signing/verification itself now lives in lib/auth/jwt.ts (jose-based,
 * Edge-compatible — see docs/auth-system-port-plan.md); this file's
 * getSessionFromRequest wraps that to keep returning a full Prisma User row,
 * since ~150 existing call sites across the codebase depend on that shape
 * (email, name, etc.), not just {sub, role}. For new code that only needs
 * identity+role, prefer lib/auth/session.ts's lighter getServerSession()
 * instead — it skips the DB round-trip.
 */
import bcrypt from "bcryptjs";
import { User as PrismaUser } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { verifyToken as verifyAccessToken } from "@/lib/auth/jwt";

/** Refresh-token lifetimes now govern session length; see lib/auth/cookies.ts REFRESH_DAYS. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day (unused by the cookie itself now — kept for any remaining references)

type User = PrismaUser;

/**
 * Get session from App Router NextRequest — reads the `access_token` cookie
 * (was `session_id`; see docs/auth-system-port-plan.md for the two-cookie
 * scheme this replaced it with).
 */
export const getSessionFromRequest = async (request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): Promise<User | null> => {
  const cookie = request.cookies.get("access_token");
  const token = cookie?.value;

  if (!token) {
    return null;
  }

  const decoded = await verifyAccessToken(token);
  if (!decoded) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  return user;
};

/**
 * Client-side: fetches /api/auth/session with cookies to get current user.
 * `access_token` is httpOnly (invisible to JS by design), so — unlike the
 * old `session_id` cookie this replaced — there's no cheap client-side
 * existence check to short-circuit on; the fetch always runs and the
 * server decides based on the cookie it can see.
 */
export const getSessionClient = async (): Promise<User | null> => {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
    });

    if (response.ok) {
      const user = await response.json();
      return user;
    }

    return null;
  } catch (error) {
    return null;
  }
};

/** Hashes a plain password with bcrypt for safe storage (used on registration). */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/** Compares plain password with stored hash (used on login). */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Refresh API Route Handler — ported from Proplity (see docs/auth-system-port-plan.md, Phase 3,
 * step 3), with the later Proplity hardening (ISS-0027, ISS-0028, ISS-0029).
 *
 * Atomic rotation guard: a single `updateMany` conditioned on (tokenHash, revokedAt: null,
 * expiresAt > now), which also records the replacement's hash, is what makes "has this token
 * already been used" race-free; only one concurrent request wins the revokedAt:null predicate.
 * count === 0 means the token was invalid, expired, or (if a row exists with revokedAt already set)
 * REUSED. A reuse outside the short grace window is proof two parties hold descendants of the same
 * login, so the whole familyId is revoked. Inside the window it is almost certainly the same
 * browser retrying a refresh whose response it never received (a reload or link click aborted it
 * after the server rotated the token), so the old value is accepted once more (REFRESH_GRACE_MS).
 *
 * The new token inherits the old one's expiry: rotation changes the token value, it does not
 * extend the session the login chose (1 day, or 30 with "keep me signed in").
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { RefreshToken } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { logger } from "@/lib/logger";
import { validateCSRF } from "@/lib/auth/csrf";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { REFRESH_GRACE_MS } from "@/lib/auth/refresh-grace";
import {
  REFRESH_MAX_ATTEMPTS,
  getClientIp,
  releaseAttempt,
  reserveAttempt,
  tooManyAttempts,
} from "@/lib/auth/rate-limit-db";
import { ACCOUNT_STATUS } from "@/lib/auth/account-status";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();

  try {
    // No refresh cookie means a signed-out visitor. Every page load asks, so counting these
    // against the address budget would let anonymous traffic (or many people behind one NAT)
    // lock real users out of silent session restore. Answered before any budget is spent.
    const rawRefreshToken = cookieStore.get("refresh_token")?.value;
    if (!rawRefreshToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kept on every failure path, handed back on success: only failures count.
    const reservation = await reserveAttempt(
      `refresh:${getClientIp(request)}`,
      REFRESH_MAX_ATTEMPTS,
    );
    if (!reservation.allowed) {
      return NextResponse.json(tooManyAttempts(reservation), { status: 429 });
    }

    const tokenHash = hashToken(rawRefreshToken);
    // Chosen up front so the rotation is one atomic statement that also records its replacement;
    // a retry that lands while the new row is still being written then sees the link instead of a
    // bare revocation that looks like theft.
    const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = hashToken(newRawRefreshToken);

    const rotated = await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date(), replacedBy: newTokenHash },
    });

    // Set when the old value of a token rotated moments ago is accepted once more.
    let graceToken: RefreshToken | null = null;

    if (rotated.count === 0) {
      const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (existing?.revokedAt) {
        const withinGrace =
          existing.replacedBy !== null &&
          existing.expiresAt > new Date() &&
          Date.now() - existing.revokedAt.getTime() < REFRESH_GRACE_MS;
        if (withinGrace) {
          // The response that carried the replacement may have been lost. Take the replacement
          // out of service with one atomic claim: only the first retry wins, so the old value
          // works once more, never twice. A losing retry gets a 401 and leaves the family and
          // the cookies alone (the winner has just set new ones).
          const claimed = await prisma.refreshToken.updateMany({
            where: { tokenHash: existing.replacedBy!, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          if (claimed.count === 0) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          graceToken = existing;
        } else {
          await prisma.refreshToken.updateMany({
            where: { familyId: existing.familyId },
            data: { revokedAt: new Date() },
          });
          logger.warn("Refresh token reuse detected — family revoked", {
            familyId: existing.familyId,
          });
        }
      }
      if (!graceToken) {
        clearAuthCookies(cookieStore);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const currentToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!currentToken || currentToken.user.role === undefined) {
      clearAuthCookies(cookieStore);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Decision (a): a session opened while ACTIVE must stop working the moment an admin
    // suspends the account — not just block the next login. PENDING_VERIFICATION is checked
    // defensively too, though register issues no session for it in practice. Revokes the
    // whole family, same as a detected-theft reuse, so every tab this account held is signed
    // out, not just this one request.
    if (
      currentToken.user.status === ACCOUNT_STATUS.SUSPENDED ||
      currentToken.user.status === ACCOUNT_STATUS.PENDING_VERIFICATION
    ) {
      await prisma.refreshToken.updateMany({
        where: { familyId: currentToken.familyId },
        data: { revokedAt: new Date() },
      });
      clearAuthCookies(cookieStore);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await releaseAttempt(reservation.attemptId);

    await prisma.$transaction([
      // In the grace case the old row keeps pointing at the replacement it handed out, so a
      // second retry finds that replacement already claimed; the chain continues from the new one.
      ...(graceToken?.replacedBy
        ? [
            prisma.refreshToken.updateMany({
              where: { tokenHash: graceToken.replacedBy },
              data: { replacedBy: newTokenHash },
            }),
          ]
        : []),
      prisma.refreshToken.create({
        data: {
          userId: currentToken.userId,
          tokenHash: newTokenHash,
          familyId: currentToken.familyId,
          expiresAt: currentToken.expiresAt,
        },
      }),
    ]);

    const accessToken = await signAccessToken({
      sub: currentToken.userId,
      role: currentToken.user.role ?? "user",
    });

    // The cookie lives exactly as long as the row does, not a fixed week.
    const remainingSeconds = Math.max(
      0,
      Math.floor((currentToken.expiresAt.getTime() - Date.now()) / 1000),
    );
    setAuthCookies(cookieStore, accessToken, newRawRefreshToken, remainingSeconds);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error("Refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

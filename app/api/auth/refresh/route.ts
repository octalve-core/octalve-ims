/**
 * Refresh API Route Handler — new route, did not exist before this port.
 * Ported from Proplity byte-for-byte in mechanism (see
 * out/auth-system-port-plan.md, Phase 3, step 3 — this is the single most
 * important piece to get exactly right).
 *
 * Atomic rotation-guard: a single `updateMany` conditioned on
 * (tokenHash, revokedAt: null, expiresAt > now) is what makes "has this
 * token already been used" race-free — only one concurrent request can win
 * the revokedAt:null predicate. count === 0 means the token was invalid,
 * expired, or (if a row exists with revokedAt already set) REUSED — proof
 * two parties possess descendants of the same login, so the whole
 * familyId is revoked, not just the reused token.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/prisma/client";
import { logger } from "@/lib/logger";
import { validateCSRF } from "@/lib/auth/csrf";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies, clearAuthCookies, REFRESH_DAYS } from "@/lib/auth/cookies";
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimited = await withRateLimit(request, defaultRateLimits.auth);
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();

  try {
    const rawRefreshToken = cookieStore.get("refresh_token")?.value;
    if (!rawRefreshToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokenHash = hashToken(rawRefreshToken);

    // Atomic: only the request that actually flips revokedAt:null -> now
    // gets count === 1. A simultaneous duplicate request, or a later replay
    // of an already-rotated token, gets count === 0.
    const rotated = await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });

    if (rotated.count === 0) {
      const existing = await prisma.refreshToken.findUnique({
        where: { tokenHash },
      });
      if (existing && existing.revokedAt) {
        // Reuse of an already-rotated token — proof of compromise. Kill the
        // whole lineage, including the legitimately-rotated successor, not
        // just this reused artifact.
        await prisma.refreshToken.updateMany({
          where: { familyId: existing.familyId },
          data: { revokedAt: new Date() },
        });
        logger.warn("Refresh token reuse detected — family revoked", {
          familyId: existing.familyId,
        });
      }
      clearAuthCookies(cookieStore);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!currentToken || currentToken.user.role === undefined) {
      clearAuthCookies(cookieStore);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = hashToken(newRawRefreshToken);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: currentToken.id },
        data: { replacedBy: newTokenHash },
      }),
      prisma.refreshToken.create({
        data: {
          userId: currentToken.userId,
          tokenHash: newTokenHash,
          familyId: currentToken.familyId,
          expiresAt: new Date(
            Date.now() + REFRESH_DAYS.default * 24 * 60 * 60 * 1000
          ),
        },
      }),
    ]);

    const accessToken = await signAccessToken({
      sub: currentToken.userId,
      role: currentToken.user.role ?? "user",
    });

    setAuthCookies(
      cookieStore,
      accessToken,
      newRawRefreshToken,
      REFRESH_DAYS.default * 24 * 60 * 60
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

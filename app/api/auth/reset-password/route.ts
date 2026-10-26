/**
 * Reset Password API Route Handler
 * Consumes a token minted by POST /api/auth/forgot-password and sets a new
 * password. Deliberately CSRF-exempt, same reasoning as verify-email: this
 * is reached via an emailed link, a legitimate cross-origin-by-nature flow
 * that can't rely on a pre-existing same-origin session — the single-use
 * token itself is the proof of intent. Revokes every active refresh token
 * (same "log out everywhere" semantics as change-password) so a stolen
 * session can't survive a reset.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { prisma } from "@/prisma/client";
import { scheduleInvalidateAuthCaches } from "@/lib/cache";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { getClientIp, reserveAttempt, tooManyAttempts } from "@/lib/auth/rate-limit-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = resetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }
    const { token, password } = validationResult.data;

    // Every attempt counts, good or bad: a reset link is a one-shot secret, so there is nothing
    // to hand back (ISS-0027).
    const reservation = await reserveAttempt(`reset:${getClientIp(request)}`);
    if (!reservation.allowed) {
      return NextResponse.json(tooManyAttempts(reservation), { status: 429 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // The token is claimed by deleting it, and the password changes only for the request whose
    // delete removed a row: of two requests holding the same link at once, one wins.
    const claimed = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count === 0) return false;
      await tx.user.update({
        where: { id: record.userId },
        data: { password: passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
    if (!claimed) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);
    await scheduleInvalidateAuthCaches();

    return NextResponse.json({
      success: true,
      message: "Password updated. Please log in with your new password.",
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";

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

    const rateLimited = await withRateLimit(request, defaultRateLimits.auth);
    if (rateLimited) return rateLimited;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: passwordHash },
      }),
      prisma.verificationToken.delete({ where: { id: record.id } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

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

/**
 * Forgot Password API Route Handler
 * Requests a password reset link for an email. Uses its own
 * PasswordResetToken model (userId unique — one live token per user),
 * deliberately separate from VerificationToken (which invite/activation
 * flows use to let a not-yet-activated user set an initial password) —
 * sharing that table would let a reset request silently clobber a
 * still-pending invite link for the same user. Always responds with a
 * generic success message regardless of whether the email is registered,
 * to avoid leaking which emails have accounts.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { prisma } from "@/prisma/client";
import { validateCSRF } from "@/lib/auth/csrf";
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";
import { isBrevoConfigured } from "@/lib/email/brevo";
import { sendEmailViaBrevo } from "@/lib/email/brevo";
import { generatePasswordResetEmail } from "@/lib/email/templates";

const RESET_TOKEN_TTL_MINUTES = 60;

const GENERIC_SUCCESS = {
  success: true,
  message:
    "If an account exists for that email, a password reset link has been sent.",
};

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validationResult = forgotPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { email } = validationResult.data;

    const rateLimited = await withRateLimit(
      request,
      defaultRateLimits.auth,
      `forgot-password:${email}`,
    );
    if (rateLimited) return rateLimited;

    const user = await prisma.user.findUnique({ where: { email } });

    // Only a user with a password can reset one (OAuth-only accounts have
    // no password to reset) — still return the generic response either way.
    if (!user || !user.password) {
      logger.info("Forgot-password request for unknown/passwordless email", {
        email,
      });
      return NextResponse.json(GENERIC_SUCCESS);
    }

    if (!isBrevoConfigured()) {
      logger.warn(
        "Brevo email service is not configured, cannot send password reset email",
      );
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    const resetUrl = `${request.nextUrl.origin}/reset-password?token=${rawToken}`;
    const emailContent = generatePasswordResetEmail({
      resetUrl,
      userName: user.name ?? undefined,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });

    const result = await sendEmailViaBrevo({
      to: { email: user.email, name: user.name ?? undefined },
      subject: emailContent.subject,
      htmlContent: emailContent.htmlContent,
      textContent: emailContent.textContent,
      tags: ["password-reset"],
    });

    if (!result.success) {
      logger.error("Failed to send password reset email", {
        userId: user.id,
        error: result.error,
      });
    }

    return NextResponse.json(GENERIC_SUCCESS);
  } catch (error) {
    logger.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

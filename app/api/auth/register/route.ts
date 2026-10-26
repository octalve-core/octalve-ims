/**
 * Register API Route Handler
 * Auth mechanics ported from Proplity — see docs/auth-system-port-plan.md.
 * Rate limiting uses the database-backed lib/auth/rate-limit-db.ts (ISS-0027); the Redis limiter
 * in lib/api/rate-limit.ts allows everything when Redis is missing, which is wrong for auth.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { scheduleInvalidateAuthCaches } from "@/lib/cache";
import { prisma } from "@/prisma/client";
import { validateCSRF } from "@/lib/auth/csrf";
import { getClientIp, reserveAttempt, tooManyAttempts } from "@/lib/auth/rate-limit-db";
import { ACCOUNT_STATUS } from "@/lib/auth/account-status";
import { isBrevoConfigured, sendEmailViaBrevo } from "@/lib/email/brevo";
import { generateVerificationEmail } from "@/lib/email/templates";

const VERIFY_TOKEN_TTL_MINUTES = 24 * 60;

/**
 * Creates (or replaces) the account's verification token and emails the link. Deferred to
 * `after()` so the response isn't held on an external email-API call (decision a).
 */
async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  origin: string,
) {
  try {
    if (!isBrevoConfigured()) {
      logger.warn("Brevo email service is not configured, cannot send verification email");
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.verificationToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    const verifyUrl = `${origin}/verify-email?token=${rawToken}`;
    const emailContent = generateVerificationEmail({
      verifyUrl,
      userName: user.name,
      expiresInMinutes: VERIFY_TOKEN_TTL_MINUTES,
    });

    const result = await sendEmailViaBrevo({
      to: { email: user.email, name: user.name },
      subject: emailContent.subject,
      htmlContent: emailContent.htmlContent,
      textContent: emailContent.textContent,
      tags: ["email-verification"],
    });

    if (!result.success) {
      logger.error("Failed to send verification email", { userId: user.id, error: result.error });
    }
  } catch (error) {
    logger.error("Verification email error:", error);
  }
}

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Per address; every registration counts (ISS-0027). Uses the database limiter, which cannot
  // switch itself off when Redis is missing.
  const reservation = await reserveAttempt(`register:${getClientIp(request)}`);
  if (!reservation.allowed) {
    return NextResponse.json(tooManyAttempts(reservation), { status: 429 });
  }

  try {
    const body = await request.json();

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid registration data", {
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { name, email, password } = validationResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate a unique username (Postgres unique index is sparse-by-default
    // w.r.t. NULLs, so — unlike the old Mongo path this replaces — no
    // dropIndex/createIndex self-heal is needed for googleId uniqueness).
    const baseUsername = email.split("@")[0];
    let username = baseUsername;
    let counter = 1;
    while (await prisma.user.findFirst({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // ISS-0001: self-registration used to grant "admin" unconditionally,
    // letting any anonymous visitor mint a global admin account — one with
    // full, unscoped access to every user, order and invoice in the
    // deployment (see docs/issues/README.md). "user" is the least-privileged
    // legacy role (lib/auth/can.ts) and already has everything a new
    // self-service signup actually needs: view/create/edit on Products,
    // Stock, Orders, Invoicing, and view/create on SupportTickets. Admin
    // accounts must be provisioned out-of-band (seed scripts, or a future
    // invite flow), never handed out by self-registration.
    // Decision (a): self-registration requires email verification, so no session is issued
    // yet — login (and refresh, defensively) both refuse PENDING_VERIFICATION. OAuth sign-ups
    // and admin-created accounts skip this: the provider or the admin already vouches for the
    // email (see lib/auth/account-status.ts).
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
        role: "user",
        status: ACCOUNT_STATUS.PENDING_VERIFICATION,
      },
    });

    const origin = request.nextUrl.origin;
    after(() => sendVerificationEmail(createdUser, origin));

    await scheduleInvalidateAuthCaches();
    return NextResponse.json(
      {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        status: createdUser.status,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Registration error:", error);

    // The cause is logged above; the caller gets no database or library error text (ISS-0032).
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
